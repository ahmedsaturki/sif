import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { PostgresTransactionalEventStore } from '../dist/src/postgres.js';

const HOST = process.env.PGHOST ?? '127.0.0.1';
const PORT = Number(process.env.PGPORT ?? 5432);
const USER = process.env.PGUSER ?? 'postgres';
const DATABASE = process.env.PGDATABASE ?? 'postgres';

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
    await this.waitReady();
  }

  waitReady() {
    return new Promise((resolve, reject) => { this.readyWaiter = { resolve, reject }; });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 5) {
      const tag = String.fromCharCode(this.buffer[0]);
      const len = this.buffer.readInt32BE(1);
      if (this.buffer.length < len + 1) return;
      const payload = this.buffer.subarray(5, len + 1);
      this.buffer = this.buffer.subarray(len + 1);
      if (tag === 'Z') {
        this.finishReady(payload);
      } else if (tag === 'E') {
        this.rejectActive(new Error(decodeError(payload)));
      } else {
        this.collect(tag, payload);
      }
    }
  }

  collect(tag, payload) {
    if (!this.active) return;
    if (tag === 'T') this.active.columns = decodeRowDescription(payload);
    else if (tag === 'D') this.active.rows.push(decodeDataRow(payload));
    else if (tag === 'C') this.active.command = decodeCString(payload);
  }

  query(sql) {
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

  finishReady(payload) {
    if (this.readyWaiter) {
      this.readyWaiter.resolve(payload);
      this.readyWaiter = null;
    }
    if (this.active) {
      const active = this.active;
      this.active = null;
      const rows = active.rows.map((fields) => Object.fromEntries(active.columns.map((name, i) => [name, fields[i]])));
      active.resolve({ rows, rowCount: rows.length, command: active.command });
    }
  }

  rejectActive(error) {
    if (this.readyWaiter) {
      this.readyWaiter.reject(error);
      this.readyWaiter = null;
    }
    if (this.active) {
      const active = this.active;
      this.active = null;
      active.reject(error);
    }
  }

  close() { this.socket.end(); }
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

function sqlLiteral(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

class WirePgClientAdapter {
  constructor(client) { this.client = client; }
  async query(text, values = []) {
    let sql = text;
    for (let i = values.length; i >= 1; i -= 1) sql = sql.replaceAll(`$${i}`, sqlLiteral(values[i - 1]));
    return this.client.query(sql);
  }
}

class WirePgPool {
  constructor() { this.client = new PgWireClient(); }
  async connect() { await this.client.ready; const adapter = new WirePgClientAdapter(this.client); adapter.release = () => {}; return adapter; }
  close() { this.client.close(); }
}

function event(streamId, version, id) {
  const timestamp = new Date().toISOString();
  return {
    eventId: id,
    eventType: 'postgres.integration.test',
    streamId,
    streamVersion: version,
    occurredAt: timestamp,
    observedAt: timestamp,
    actorId: 'integration-test',
    correlationId: `corr-${id}`,
    payload: { value: id },
    metadata: { test: 'live-postgres' }
  };
}

const canRun = process.env.RUN_POSTGRES_INTEGRATION === '1';

test('live PostgreSQL transactional append serializes concurrent writers and persists exactly one event/outbox pair', { skip: !canRun }, async () => {
  const poolA = new WirePgPool();
  const poolB = new WirePgPool();
  const check = new PgWireClient();
  await Promise.all([poolA.client.ready, poolB.client.ready, check.ready]);
  const streamId = `it-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    const cleanup = async (client) => {
      await client.query(`DELETE FROM sif_outbox WHERE event_id IN (SELECT event_id FROM sif_events WHERE stream_id = '${streamId}')`);
      await client.query(`DELETE FROM sif_events WHERE stream_id = '${streamId}'`);
      await client.query(`DELETE FROM sif_stream_heads WHERE stream_id = '${streamId}'`);
    };
    await cleanup(check);
    const storeA = new PostgresTransactionalEventStore(poolA);
    const storeB = new PostgresTransactionalEventStore(poolB);
    const results = await Promise.allSettled([
      storeA.appendAndEnqueue(event(streamId, 1, randomUUID()), { expectedStreamVersion: 0 }, ['integration']),
      storeB.appendAndEnqueue(event(streamId, 1, randomUUID()), { expectedStreamVersion: 0 }, ['integration'])
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.match(String(rejected[0].reason), /expected 0|current=1|Concurrency/i);

    const state = await check.query(`SELECT h.stream_version, (SELECT count(*) FROM sif_events e WHERE e.stream_id = h.stream_id) AS events, (SELECT count(*) FROM sif_outbox o JOIN sif_events e ON e.event_id = o.event_id WHERE e.stream_id = h.stream_id) AS outbox FROM sif_stream_heads h WHERE h.stream_id = '${streamId}'`);
    assert.equal(state.rows[0].stream_version, '1');
    assert.equal(state.rows[0].events, '1');
    assert.equal(state.rows[0].outbox, '1');
  } finally {
    await check.query(`DELETE FROM sif_outbox WHERE event_id IN (SELECT event_id FROM sif_events WHERE stream_id = '${streamId}')`).catch(() => {});
    await check.query(`DELETE FROM sif_events WHERE stream_id = '${streamId}'`).catch(() => {});
    await check.query(`DELETE FROM sif_stream_heads WHERE stream_id = '${streamId}'`).catch(() => {});
    check.close();
    poolA.close();
    poolB.close();
  }
});
