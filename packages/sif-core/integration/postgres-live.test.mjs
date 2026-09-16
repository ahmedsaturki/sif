import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { PostgresTransactionalEventStore } from '../dist/src/postgres.js';

const HOST = process.env.PGHOST ?? '127.0.0.1';
const PORT = Number(process.env.PGPORT ?? 5432);
const USER = process.env.PGUSER ?? 'postgres';
const DATABASE = process.env.PGDATABASE ?? 'postgres';

class PgWireClient {
  constructor() {
    this.socket = net.createConnection({ host: HOST, port: PORT });
    this.buffer = Buffer.alloc(0);
    this.waiters = [];
    this.ready = this.open();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('error', reject);
    });
    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('error', (error) => this.rejectAll(error));
    const params = Buffer.concat([
      Buffer.from('user\0'), Buffer.from(USER), Buffer.from('\0'),
      Buffer.from('database\0'), Buffer.from(DATABASE), Buffer.from('\0\0')
    ]);
    const body = Buffer.allocUnsafe(4 + params.length);
    body.writeInt32BE(196608, 0);
    params.copy(body, 4);
    const packet = Buffer.allocUnsafe(4 + body.length);
    packet.writeInt32BE(packet.length, 0);
    body.copy(packet, 4);
    this.socket.write(packet);
    await this.waitReady();
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 5) {
      const tag = String.fromCharCode(this.buffer[0]);
      const len = this.buffer.readInt32BE(1);
      if (this.buffer.length < 1 + len) return;
      const payload = this.buffer.subarray(5, 1 + len);
      this.buffer = this.buffer.subarray(1 + len);
      if (tag === 'Z') this.resolveWait({ tag, payload });
      else if (tag === 'E') this.rejectWait(new Error(decodeError(payload)));
      else this.collect(tag, payload);
    }
  }

  collect(tag, payload) {
    const current = this.active;
    if (!current) return;
    if (tag === 'T') current.rows = [];
    if (tag === 'D') current.rows.push(decodeDataRow(payload));
    if (tag === 'C') current.command = decodeCString(payload);
  }

  query(sql) {
    return new Promise((resolve, reject) => {
      const run = { resolve, reject, rows: [], command: '' };
      this.active = run;
      const text = Buffer.from(sql + '\0');
      const packet = Buffer.allocUnsafe(5 + text.length);
      packet[0] = 0x51;
      packet.writeInt32BE(4 + text.length, 1);
      text.copy(packet, 5);
      this.socket.write(packet);
    });
  }

  waitReady() {
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  resolveWait(value) {
    if (this.waiters.length) this.waiters.shift().resolve(value);
    const active = this.active;
    if (active) {
      this.active = null;
      active.resolve({ rows: active.rows ?? [], rowCount: active.rows?.length ?? 0, command: active.command ?? '' });
    }
  }

  rejectWait(error) {
    if (this.waiters.length) this.waiters.shift().reject(error);
    const active = this.active;
    if (active) {
      this.active = null;
      active.reject(error);
    }
  }

  rejectAll(error) {
    this.rejectWait(error);
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }

  close() { this.socket.end(); }
}

function decodeCString(buf) {
  const index = buf.indexOf(0);
  return buf.subarray(0, index < 0 ? buf.length : index).toString('utf8');
}

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

function decodeDataRow(buf) {
  const count = buf.readInt16BE(0);
  let offset = 2;
  const fields = [];
  for (let i = 0; i < count; i += 1) {
    const len = buf.readInt32BE(offset);
    offset += 4;
    if (len === -1) fields.push(null);
    else {
      fields.push(buf.subarray(offset, offset + len).toString('utf8'));
      offset += len;
    }
  }
  return fields;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `ARRAY[${value.map(sqlLiteral).join(',')}]`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

class WirePgAdapter {
  constructor(client) { this.client = client; }
  async query(text, values = []) {
    let sql = text;
    for (let i = values.length; i >= 1; i -= 1) sql = sql.replaceAll(`$${i}`, sqlLiteral(values[i - 1]));
    const result = await this.client.query(sql);
    return { rows: result.rows.map((fields) => ({ stream_version: fields[0] })), rowCount: result.rowCount };
  }
}

function event(streamId, version, id) {
  const now = new Date().toISOString();
  return {
    eventId: id,
    eventType: 'postgres.integration.test',
    streamId,
    streamVersion: version,
    occurredAt: now,
    observedAt: now,
    actorId: 'integration-test',
    correlationId: `corr-${id}`,
    payload: { value: id },
    metadata: { test: 'live-postgres' }
  };
}

const canRun = process.env.RUN_POSTGRES_INTEGRATION === '1';

test('live PostgreSQL transactional append serializes concurrent writers and preserves durable outbox rows', { skip: !canRun }, async () => {
  const a = new PgWireClient();
  const b = new PgWireClient();
  await Promise.all([a.ready, b.ready]);
  const streamId = `it-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    const clean = async (client) => {
      await client.query(`DELETE FROM sif_outbox WHERE event_id IN (SELECT event_id FROM sif_events WHERE stream_id = '${streamId}')`);
      await client.query(`DELETE FROM sif_events WHERE stream_id = '${streamId}'`);
      await client.query(`DELETE FROM sif_stream_heads WHERE stream_id = '${streamId}'`);
    };
    await clean(a);
    const storeA = new PostgresTransactionalEventStore(new WirePgAdapter(a));
    const storeB = new PostgresTransactionalEventStore(new WirePgAdapter(b));
    const results = await Promise.allSettled([
      storeA.appendAndEnqueue(event(streamId, 1, crypto.randomUUID()), { expectedStreamVersion: 0 }, ['integration']),
      storeB.appendAndEnqueue(event(streamId, 1, crypto.randomUUID()), { expectedStreamVersion: 0 }, ['integration'])
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.match(String(rejected[0].reason), /expected 0|current=1|Concurrency/i);

    const check = new PgWireClient();
    await check.ready;
    try {
      const version = await check.query(`SELECT stream_version FROM sif_stream_heads WHERE stream_id = '${streamId}'`);
      assert.equal(version.rows[0][0], '1');
      const counts = await check.query(`SELECT (SELECT count(*) FROM sif_events WHERE stream_id='${streamId}'), (SELECT count(*) FROM sif_outbox WHERE event_id IN (SELECT event_id FROM sif_events WHERE stream_id='${streamId}'))`);
      assert.equal(counts.rows[0][0], '1');
      assert.equal(counts.rows[0][1], '1');
    } finally {
      await clean(check);
      check.close();
    }
  } finally {
    a.close();
    b.close();
  }
});
