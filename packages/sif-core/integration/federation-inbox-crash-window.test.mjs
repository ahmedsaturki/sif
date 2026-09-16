import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { PostgresFederatedInbox } from '../dist/src/index.js';

const HOST = process.env.PGHOST ?? '127.0.0.1';
const PORT = Number(process.env.PGPORT ?? 5432);
const USER = process.env.PGUSER ?? 'postgres';
const DATABASE = process.env.PGDATABASE ?? 'postgres';
const canRun = process.env.RUN_POSTGRES_INTEGRATION === '1';

class PgWireClient {
  constructor() {
    this.socket = net.createConnection({ host: HOST, port: PORT });
    this.buffer = Buffer.alloc(0);
    this.ready = this.open();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('error', reject);
    });
    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('error', (error) => this.rejectActive(error));
    const params = Buffer.from(`user\0${USER}\0database\0${DATABASE}\0\0`);
    const body = Buffer.allocUnsafe(4 + params.length);
    body.writeInt32BE(196608, 0);
    params.copy(body, 4);
    const packet = Buffer.allocUnsafe(4 + body.length);
    packet.writeInt32BE(packet.length, 0);
    body.copy(packet, 4);
    this.socket.write(packet);
    await new Promise((resolve, reject) => { this.readyWaiter = { resolve, reject }; });
  }
  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 5) {
      const tag = String.fromCharCode(this.buffer[0]);
      const len = this.buffer.readInt32BE(1);
      if (len < 4) { this.rejectActive(new Error('invalid message format')); return; }
      if (this.buffer.length < len + 1) return;
      const payload = this.buffer.subarray(5, len + 1);
      this.buffer = this.buffer.subarray(len + 1);
      if (tag === 'Z') this.finishReady();
      else if (tag === 'E') this.rejectActive(new Error(decodeError(payload)));
      else this.collect(tag, payload);
    }
  }
  collect(tag, payload) {
    if (!this.active) return;
    if (tag === 'T') this.active.columns = decodeRowDescription(payload);
    else if (tag === 'D') this.active.rows.push(decodeDataRow(payload));
    else if (tag === 'C') this.active.command = decodeCString(payload);
  }
  query(sql) {
    if (sql.includes('\u0000')) throw new Error('NUL is forbidden in PostgreSQL simple queries');
    if (this.active) throw new Error('concurrent simple queries on one wire client are unsupported');
    return new Promise((resolve, reject) => {
      this.active = { resolve, reject, columns: [], rows: [], command: '' };
      const text = Buffer.from(sql + '\0');
      const packet = Buffer.allocUnsafe(5 + text.length);
      packet[0] = 0x51;
      packet.writeInt32BE(4 + text.length, 1);
      text.copy(packet, 5);
      this.socket.write(packet);
    });
  }
  finishReady() {
    if (this.readyWaiter) { this.readyWaiter.resolve(); this.readyWaiter = null; }
    if (this.active) {
      const active = this.active;
      this.active = null;
      const rows = active.rows.map((fields) => Object.fromEntries(active.columns.map((name, i) => [name, fields[i]])));
      active.resolve({ rows, rowCount: rows.length, command: active.command });
    }
  }
  rejectActive(error) {
    if (this.readyWaiter) { this.readyWaiter.reject(error); this.readyWaiter = null; }
    if (this.active) { const active = this.active; this.active = null; active.reject(error); }
  }
  close() { this.socket.destroy(); }
}

function decodeCString(buf) { const i = buf.indexOf(0); return buf.subarray(0, i < 0 ? buf.length : i).toString('utf8'); }
function decodeError(buf) {
  const fields = {};
  let i = 0;
  while (i < buf.length && buf[i] !== 0) {
    const code = String.fromCharCode(buf[i++]);
    const end = buf.indexOf(0, i);
    if (end < 0) break;
    fields[code] = buf.subarray(i, end).toString('utf8');
    i = end + 1;
  }
  return fields.M || fields.S || 'PostgreSQL error';
}
function decodeRowDescription(buf) {
  const count = buf.readInt16BE(0);
  let offset = 2;
  const columns = [];
  for (let i = 0; i < count; i += 1) {
    const end = buf.indexOf(0, offset);
    columns.push(buf.subarray(offset, end).toString('utf8'));
    offset = end + 1 + 18;
  }
  return columns;
}
function decodeDataRow(buf) {
  const count = buf.readInt16BE(0);
  let offset = 2;
  const fields = [];
  for (let i = 0; i < count; i += 1) {
    const len = buf.readInt32BE(offset);
    offset += 4;
    if (len === -1) fields.push(null);
    else { fields.push(buf.subarray(offset, offset + len).toString('utf8')); offset += len; }
  }
  return fields;
}
function sqlLiteral(value) { return `'${String(value).replaceAll("'", "''")}'`; }
class WirePgAdapter {
  constructor(client) { this.client = client; }
  async query(text, values = []) {
    let sql = text;
    for (let i = values.length; i >= 1; i -= 1) sql = sql.replaceAll(`$${i}`, sqlLiteral(values[i - 1]));
    return this.client.query(sql);
  }
}
class WirePgPool {
  constructor() { this.client = new PgWireClient(); }
  async connect() { await this.client.ready; const adapter = new WirePgAdapter(this.client); adapter.release = () => {}; return adapter; }
  async query(text, values = []) { await this.client.ready; return new WirePgAdapter(this.client).query(text, values); }
  close() { this.client.close(); }
}
function federationEnvelope(messageId) {
  return {
    protocol: 'sif-federation', protocolVersion: '0.1', schema: 'sif.federation.envelope', schemaVersion: '1',
    sender: { domain: 'domain-a', subject: 'workload-a', transportBinding: 'spiffe://domain-a/workload-a' },
    targetDomain: 'domain-b', messageId, eventId: `event-${messageId}`, provenanceId: `prov-${messageId}`,
    time: { occurredAt: '2026-09-16T06:00:00.000Z', observedAt: '2026-09-16T06:00:01.000Z', expiresAt: '2026-09-16T07:00:00.000Z', semantics: 'event-and-observation' },
    capabilities: [], payload: { type: 'evidence', data: { messageId } }, replayNonce: `nonce-${messageId}`,
    payloadDigest: 'integration-test', signatureAlgorithm: 'Ed25519', signature: 'integration-test-signature',
  };
}

test('federated inbox crash before commit rolls back inbox/effect and allows safe retry', { skip: !canRun }, async () => {
  const crashPool = new WirePgPool();
  const retryPool = new WirePgPool();
  const check = new PgWireClient();
  await Promise.all([crashPool.client.ready, retryPool.client.ready, check.ready]);
  const consumerId = `federation-crash-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const messageId = randomUUID();
  const envelope = federationEnvelope(messageId);
  const table = `sif_test_fed_crash_${Date.now()}_${Math.random().toString(16).slice(2)}`.replaceAll('-', '_');
  try {
    await check.query(`CREATE TABLE ${table} (id TEXT PRIMARY KEY)`);
    const inbox = new PostgresFederatedInbox(crashPool);
    await assert.rejects(
      inbox.process(envelope, consumerId, async (client) => {
        await client.query(`INSERT INTO ${table} (id) VALUES ('crash-effect')`);
        await client.query('SELECT pg_terminate_backend(pg_backend_pid())');
        return 'never-committed';
      }),
    );

    const durable = await check.query(`SELECT count(*) AS count FROM sif_federated_inbox WHERE consumer_id='${consumerId}' AND message_id='${messageId}'`);
    const effects = await check.query(`SELECT count(*) AS count FROM ${table}`);
    assert.equal(durable.rows[0].count, '0');
    assert.equal(effects.rows[0].count, '0');

    const retryInbox = new PostgresFederatedInbox(retryPool);
    const retry = await retryInbox.process(envelope, consumerId, async (client) => {
      await client.query(`INSERT INTO ${table} (id) VALUES ('retry-effect')`);
      return 'retry-digest';
    });
    assert.equal(retry.accepted, true);
    assert.equal(retry.record.state, 'COMMITTED');

    const retryEffects = await check.query(`SELECT count(*) AS count FROM ${table}`);
    assert.equal(retryEffects.rows[0].count, '1');
  } finally {
    await check.query(`DROP TABLE IF EXISTS ${table}`).catch(() => {});
    await check.query(`DELETE FROM sif_federated_inbox WHERE consumer_id='${consumerId}'`).catch(() => {});
    check.close(); crashPool.close(); retryPool.close();
  }
});
