import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresEventStore, PostgresTransactionalEventStore } from '../src/postgres.js';
import type { PgClientLike } from '../src/postgres.js';
import type { EventEnvelope } from '../src/types.js';
import { eventDigest } from '../src/integrity.js';

class FakeClient implements PgClientLike {
  inTx = false; committed = false; rolledBack = false;
  events: Record<string, unknown>[] = []; outbox: Record<string, unknown>[] = []; heads = new Map<string, number>();
  async query<T = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
    if (text === 'BEGIN') { this.inTx = true; return { rows: [], rowCount: 0 }; }
    if (text.startsWith('INSERT INTO sif_stream_heads')) { const s=String(values[0]); if(!this.heads.has(s)) this.heads.set(s,0); return {rows:[],rowCount:1}; }
    if (text.includes('SELECT stream_version FROM sif_stream_heads')) { const s=String(values[0]); return {rows:[{stream_version:this.heads.get(s) ?? 0} as T],rowCount:1}; }
    if (text.startsWith('UPDATE sif_stream_heads')) { this.heads.set(String(values[0]), Number(values[1])); return {rows:[],rowCount:1}; }
    if (text === 'COMMIT') { this.committed = true; this.inTx = false; return { rows: [], rowCount: 0 }; }
    if (text === 'ROLLBACK') { this.rolledBack = true; this.inTx = false; return { rows: [], rowCount: 0 }; }
    if (text.includes('MAX(stream_version)')) { const streamId = String(values[0]); const max = this.events.filter(e => e.stream_id === streamId).reduce((m, e) => Math.max(m, Number(e.stream_version)), 0); return { rows: [{ stream_version: max } as T], rowCount: 1 }; }
    if (text.includes('SELECT event_digest FROM sif_events')) { const streamId = String(values[0]); const found = this.events.filter(e => e.stream_id === streamId).sort((a,b)=>Number(b.stream_version)-Number(a.stream_version))[0]; return { rows: found ? [{ event_digest: found.event_digest } as T] : [], rowCount: found ? 1 : 0 }; }
    if (text.startsWith('INSERT INTO sif_events')) { const [stream_id, stream_version, event_id, event_type, occurred_at, observed_at, effective_at, actor_id, correlation_id, causation_id, payload, metadata, event_digest, previous_digest] = values; this.events.push({stream_id,stream_version,event_id,event_type,occurred_at,observed_at,effective_at,actor_id,correlation_id,causation_id,payload:JSON.parse(String(payload)),metadata:JSON.parse(String(metadata)),event_digest,previous_digest,created_at:'2026-09-16T00:00:00.000Z'}); return { rows: [], rowCount: 1 }; }
    if (text.startsWith('INSERT INTO sif_outbox')) { const [outbox_id,event_id,destination,payload_digest,created_at] = values; const exists=this.outbox.some(e=>e.event_id===event_id&&e.destination===destination); if(exists)return {rows:[],rowCount:0}; const row={outbox_id,event_id,destination,payload_digest,created_at,attempts:0,delivered_at:null}; this.outbox.push(row); return {rows:[row as T],rowCount:1}; }
    if (text.startsWith('SELECT * FROM sif_events WHERE stream_id')) { const streamId=String(values[0]); const from=Number(values[1]); const rows=this.events.filter(e=>e.stream_id===streamId&&Number(e.stream_version)>=from).sort((a,b)=>Number(a.stream_version)-Number(b.stream_version)); return {rows:rows as T[],rowCount:rows.length}; }
    if (text.startsWith('SELECT * FROM sif_events ORDER BY')) return {rows:this.events as T[],rowCount:this.events.length};
    throw new Error(`Unhandled SQL: ${text}`);
  }
}
function event(): EventEnvelope { return { eventId:'e1',eventType:'Created',streamId:'s',streamVersion:1,occurredAt:'2026-09-16T00:00:00.000Z',observedAt:'2026-09-16T00:00:01.000Z',actorId:'a',correlationId:'c',payload:{b:2,a:1} }; }

test('PostgresEventStore persists events through a typed client contract', async () => { const client=new FakeClient(); const store=new PostgresEventStore(client); await store.append(event(),{expectedStreamVersion:0}); assert.equal(await store.streamVersion('s'),1); assert.deepEqual(await store.read('s'),[event()]); assert.equal(client.events[0]?.event_digest,eventDigest(event(),undefined)); });
test('PostgresTransactionalEventStore atomically persists event + outbox items', async () => { const client=new FakeClient(); const pool={connect:async()=>({...client,release(){},query:client.query.bind(client)})} as any; const store=new PostgresTransactionalEventStore(pool); const items=await store.appendAndEnqueue(event(),{expectedStreamVersion:0},['A','B','A']); assert.equal(client.committed,true); assert.equal(client.rolledBack,false); assert.equal(items.length,2); assert.equal(client.events.length,1); assert.equal(client.outbox.length,2); });
test('transaction rolls back on outbox failure and does not commit', async () => { const client=new FakeClient(); const original=client.query.bind(client); client.query=async(text,values=[])=>{if(text.startsWith('INSERT INTO sif_outbox'))throw new Error('outbox unavailable');return original(text,values);}; const pool={connect:async()=>({...client,release(){},query:client.query.bind(client)})} as any; const store=new PostgresTransactionalEventStore(pool); let caught:unknown; try{await store.appendAndEnqueue(event(),{expectedStreamVersion:0},['A']);}catch(error){caught=error;} assert.equal(/outbox unavailable/.test(String((caught as Error)?.message)),true); assert.equal(client.committed,false); assert.equal(client.rolledBack,true); });
