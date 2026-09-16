import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { PostgresTransactionalEventStore, PostgresProjectionCheckpointStore, PostgresFederatedInbox } from '../dist/src/index.js';
import { PostgresOutboxWorker } from '../dist/src/worker.js';
import { digest } from '../dist/src/core.js';

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
      if (tag === 'Z') this.finishReady(payload);
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
  if (Array.isArray(value)) return `ARRAY[${value.map(sqlLiteral).join(',')}]`;
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
  async connect() {
    await this.client.ready;
    const adapter = new WirePgClientAdapter(this.client);
    adapter.release = () => {};
    return adapter;
  }
  async query(text, values = []) { await this.client.ready; return new WirePgClientAdapter(this.client).query(text, values); }
  close() { this.client.close(); }
}

function event(streamId, version, id = randomUUID()) {
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

function federationEnvelope(messageId, replayNonce = `nonce-${messageId}`) {
  return {
    protocol: 'sif-federation',
    protocolVersion: '0.1',
    schema: 'sif.federation.envelope',
    schemaVersion: '1',
    sender: { domain: 'domain-a', subject: 'workload-a', transportBinding: 'spiffe://domain-a/workload-a' },
    targetDomain: 'domain-b',
    messageId,
    eventId: `event-${messageId}`,
    provenanceId: `prov-${messageId}`,
    time: { occurredAt: '2026-09-16T06:00:00.000Z', observedAt: '2026-09-16T06:00:01.000Z', expiresAt: '2026-09-16T07:00:00.000Z', semantics: 'event-and-observation' },
    capabilities: [],
    payload: { type: 'evidence', data: { messageId } },
    replayNonce,
    payloadDigest: digest({ type: 'evidence', data: { messageId } }),
    signatureAlgorithm: 'Ed25519',
    signature: 'integration-test-signature',
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
      await client.query(`DELETE FROM sif_projection_checkpoints WHERE stream_id = '${streamId}'`);
    };
    await cleanup(check);
    const storeA = new PostgresTransactionalEventStore(poolA);
    const storeB = new PostgresTransactionalEventStore(poolB);
    const results = await Promise.allSettled([
      storeA.appendAndEnqueue(event(streamId, 1), { expectedStreamVersion: 0 }, ['integration']),
      storeB.appendAndEnqueue(event(streamId, 1), { expectedStreamVersion: 0 }, ['integration'])
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
    await check.query(`DELETE FROM sif_projection_checkpoints WHERE stream_id = '${streamId}'`).catch(() => {});
    check.close();
    poolA.close();
    poolB.close();
  }
});

test('live PostgreSQL transaction rolls back event, stream head, and outbox together on constraint failure', { skip: !canRun }, async () => {
  const pool = new WirePgPool();
  const check = new PgWireClient();
  await Promise.all([pool.client.ready, check.ready]);
  const streamId = `rollback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const eventId = randomUUID();
  try {
    const cleanup = async (client) => {
      await client.query(`DELETE FROM sif_outbox WHERE event_id IN (SELECT event_id FROM sif_events WHERE stream_id = '${streamId}')`);
      await client.query(`DELETE FROM sif_events WHERE stream_id = '${streamId}'`);
      await client.query(`DELETE FROM sif_stream_heads WHERE stream_id = '${streamId}'`);
    };
    await cleanup(check);
    const store = new PostgresTransactionalEventStore(pool);
    await store.appendAndEnqueue(event(streamId, 1, eventId), { expectedStreamVersion: 0 }, ['rollback']);
    await assert.rejects(
      store.appendAndEnqueue(event(streamId, 2, eventId), { expectedStreamVersion: 1 }, ['rollback']),
      /duplicate key|unique/i
    );
    const state = await check.query(`SELECT (SELECT stream_version FROM sif_stream_heads WHERE stream_id='${streamId}') AS head, (SELECT count(*) FROM sif_events WHERE stream_id='${streamId}') AS events, (SELECT count(*) FROM sif_outbox o JOIN sif_events e ON e.event_id=o.event_id WHERE e.stream_id='${streamId}') AS outbox`);
    assert.equal(state.rows[0].head, '1');
    assert.equal(state.rows[0].events, '1');
    assert.equal(state.rows[0].outbox, '1');
  } finally {
    await check.query(`DELETE FROM sif_outbox WHERE event_id IN (SELECT event_id FROM sif_events WHERE stream_id = '${streamId}')`).catch(() => {});
    await check.query(`DELETE FROM sif_events WHERE stream_id = '${streamId}'`).catch(() => {});
    await check.query(`DELETE FROM sif_stream_heads WHERE stream_id = '${streamId}'`).catch(() => {});
    check.close();
    pool.close();
  }
});

test('live PostgreSQL projection checkpoint round-trips deterministically', { skip: !canRun }, async () => {
  const client = new PgWireClient();
  await client.ready;
  const streamId = `projection-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    const store = new PostgresProjectionCheckpointStore(new WirePgClientAdapter(client));
    const checkpoint = { projectionId: 'integration-projection', streamId, streamVersion: 7, stateDigest: digest({ value: 7 }), updatedAt: '2026-09-16T00:00:00.000Z' };
    await store.save(checkpoint);
    const loaded = await store.get(checkpoint.projectionId, checkpoint.streamId);
    assert.deepEqual(loaded, checkpoint);
  } finally {
    await client.query(`DELETE FROM sif_projection_checkpoints WHERE stream_id = '${streamId}'`).catch(() => {});
    client.close();
  }
});

test('live PostgreSQL outbox leases are exclusive, reclaimable after expiry, and owner-fenced for delivery', { skip: !canRun }, async () => {
  const poolSeed = new WirePgPool();
  const workerA = new WirePgPool();
  const workerB = new WirePgPool();
  const check = new PgWireClient();
  await Promise.all([poolSeed.client.ready, workerA.client.ready, workerB.client.ready, check.ready]);
  const streamId = `outbox-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    const cleanup = async (client) => {
      await client.query(`DELETE FROM sif_outbox WHERE event_id IN (SELECT event_id FROM sif_events WHERE stream_id = '${streamId}')`);
      await client.query(`DELETE FROM sif_events WHERE stream_id = '${streamId}'`);
      await client.query(`DELETE FROM sif_stream_heads WHERE stream_id = '${streamId}'`);
    };
    await cleanup(check);
    const seedStore = new PostgresTransactionalEventStore(poolSeed);
    const created = await seedStore.appendAndEnqueue(event(streamId, 1), { expectedStreamVersion: 0 }, ['integration']);
    assert.equal(created.length, 1);

    const a = new PostgresOutboxWorker(workerA);
    const b = new PostgresOutboxWorker(workerB);
    const claimedA = await a.claim({ limit: 1, leaseUntil: '2026-09-16T01:00:00.000Z', workerId: 'worker-a', now: '2026-09-16T00:30:00.000Z' });
    assert.equal(claimedA.length, 1);

    const blockedB = await b.claim({ limit: 1, leaseUntil: '2026-09-16T01:00:00.000Z', workerId: 'worker-b', now: '2026-09-16T00:30:00.000Z' });
    assert.equal(blockedB.length, 0);

    const reclaimed = await b.claim({ limit: 1, leaseUntil: '2026-09-16T02:00:00.000Z', workerId: 'worker-b', now: '2026-09-16T01:30:00.000Z' });
    assert.equal(reclaimed.length, 1);
    assert.equal(reclaimed[0].outboxId, claimedA[0].outboxId);

    await a.markDelivered(claimedA[0].outboxId, 'worker-a', '2026-09-16T00:31:00.000Z');
    const stillUndelivered = await check.query(`SELECT delivered_at FROM sif_outbox WHERE outbox_id='${claimedA[0].outboxId}'`);
    assert.equal(stillUndelivered.rows[0].delivered_at, null);
    await b.markDelivered(claimedA[0].outboxId, 'worker-b', '2026-09-16T00:32:00.000Z');
    const delivered = await check.query(`SELECT delivered_at, lease_owner, leased_until FROM sif_outbox WHERE outbox_id='${claimedA[0].outboxId}'`);
    assert.equal(new Date(delivered.rows[0].delivered_at).toISOString(), '2026-09-16T00:32:00.000Z');
    assert.equal(delivered.rows[0].lease_owner, null);
    assert.equal(delivered.rows[0].leased_until, null);
  } finally {
    await check.query(`DELETE FROM sif_outbox WHERE event_id IN (SELECT event_id FROM sif_events WHERE stream_id = '${streamId}')`).catch(() => {});
    await check.query(`DELETE FROM sif_events WHERE stream_id = '${streamId}'`).catch(() => {});
    await check.query(`DELETE FROM sif_stream_heads WHERE stream_id = '${streamId}'`).catch(() => {});
    check.close();
    poolSeed.close();
    workerA.close();
    workerB.close();
  }
});

test('live PostgreSQL federated inbox is durable, idempotent, and verifiable', { skip: !canRun }, async () => {
  const pool = new WirePgPool();
  const check = new PgWireClient();
  await Promise.all([pool.client.ready, check.ready]);
  const inbox = new PostgresFederatedInbox(pool);
  const consumerId = `federation-consumer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const messageId = randomUUID();
  const envelope = federationEnvelope(messageId, `nonce-${messageId}`);
  const effectTable = `sif_test_fed_effect_${Date.now()}_${Math.random().toString(16).slice(2)}`.replaceAll('-', '_');
  try {
    await check.query(`CREATE TABLE ${effectTable} (id TEXT PRIMARY KEY)`);

    let effectCalls = 0;
    const effect = async (client) => {
      effectCalls += 1;
      await client.query(`INSERT INTO ${effectTable} (id) VALUES ('effect-1')`);
      return 'result-digest-1';
    };

    const first = await inbox.process(envelope, consumerId, effect, '2026-09-16T06:00:02.000Z');
    assert.equal(first.accepted, true);
    assert.equal(first.duplicate, false);
    assert.equal(first.record.state, 'COMMITTED');
    assert.equal(first.record.resultDigest, 'result-digest-1');
    assert.equal(effectCalls, 1);

    const second = await inbox.process(envelope, consumerId, async () => {
      throw new Error('duplicate effect must not execute');
    }, '2026-09-16T06:00:03.000Z');
    assert.equal(second.accepted, false);
    assert.equal(second.duplicate, true);
    assert.equal(second.record.state, 'COMMITTED');

    const count = await check.query(`SELECT count(*) AS count FROM ${effectTable}`);
    assert.equal(count.rows[0].count, '1');

    const verified = await inbox.markVerified(consumerId, messageId, '2026-09-16T06:00:04.000Z');
    assert.equal(verified.state, 'VERIFIED');
    assert.equal(verified.resultDigest, 'result-digest-1');

    const persisted = await inbox.get(consumerId, messageId);
    assert.equal(persisted.state, 'VERIFIED');
    assert.equal(persisted.replayKey, `${envelope.sender.domain}\u0000${envelope.replayNonce}`);
  } finally {
    await check.query(`DROP TABLE IF EXISTS ${effectTable}`).catch(() => {});
    await check.query(`DELETE FROM sif_federated_inbox WHERE consumer_id = '${consumerId}'`).catch(() => {});
    check.close();
    pool.close();
  }
});

test('live PostgreSQL federated inbox rolls back durable claim and effect when effect fails', { skip: !canRun }, async () => {
  const pool = new WirePgPool();
  const check = new PgWireClient();
  await Promise.all([pool.client.ready, check.ready]);
  const inbox = new PostgresFederatedInbox(pool);
  const consumerId = `federation-rollback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const messageId = randomUUID();
  const envelope = federationEnvelope(messageId, `nonce-${messageId}`);
  const effectTable = `sif_test_fed_rollback_${Date.now()}_${Math.random().toString(16).slice(2)}`.replaceAll('-', '_');
  try {
    await check.query(`CREATE TABLE ${effectTable} (id TEXT PRIMARY KEY)`);
    await assert.rejects(
      inbox.process(envelope, consumerId, async (client) => {
        await client.query(`INSERT INTO ${effectTable} (id) VALUES ('effect-failed')`);
        throw new Error('forced federated effect failure');
      }),
      /forced federated effect failure/i,
    );

    const record = await check.query(`SELECT count(*) AS count FROM sif_federated_inbox WHERE consumer_id='${consumerId}' AND message_id='${messageId}'`);
    const effects = await check.query(`SELECT count(*) AS count FROM ${effectTable}`);
    assert.equal(record.rows[0].count, '0');
    assert.equal(effects.rows[0].count, '0');

    const retry = await inbox.process(envelope, consumerId, async (client) => {
      await client.query(`INSERT INTO ${effectTable} (id) VALUES ('effect-retry')`);
      return 'result-retry';
    }, '2026-09-16T06:00:05.000Z');
    assert.equal(retry.accepted, true);
    assert.equal(retry.record.state, 'COMMITTED');
  } finally {
    await check.query(`DROP TABLE IF EXISTS ${effectTable}`).catch(() => {});
    await check.query(`DELETE FROM sif_federated_inbox WHERE consumer_id = '${consumerId}'`).catch(() => {});
    check.close();
    pool.close();
  }
});

test('live PostgreSQL federated inbox rejects replay-key rebinding', { skip: !canRun }, async () => {
  const pool = new WirePgPool();
  const check = new PgWireClient();
  await Promise.all([pool.client.ready, check.ready]);
  const inbox = new PostgresFederatedInbox(pool);
  const consumerId = `federation-replay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const firstId = randomUUID();
  const secondId = randomUUID();
  const replayNonce = `shared-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    await inbox.process(federationEnvelope(firstId, replayNonce), consumerId, async () => 'result-1');
    await assert.rejects(
      inbox.process(federationEnvelope(secondId, replayNonce), consumerId, async () => 'result-2'),
      /Replay key is already bound/i,
    );
  } finally {
    await check.query(`DELETE FROM sif_federated_inbox WHERE consumer_id = '${consumerId}'`).catch(() => {});
    check.close();
    pool.close();
  }
});
