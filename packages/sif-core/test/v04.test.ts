import test from 'node:test';
import assert from 'node:assert/strict';
import { digest, InMemoryEventStore, SifEventWriter } from '../src/index.js';
import { ArtifactMetadataRegistry } from '../src/cas-metadata.js';
import { ReplayEngine } from '../src/replay.js';
import { PostgresTransactionalEventStore } from '../src/postgres.js';
import type { PgClientLike } from '../src/postgres.js';
import type { EventEnvelope } from '../src/types.js';

class FakeTx implements PgClientLike {
  events: Record<string, unknown>[] = []; outbox: Record<string, unknown>[] = []; heads = new Map<string, number>(); inTx = false;
  async query<T = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
    if (text === 'BEGIN') { this.inTx=true; return {rows:[],rowCount:0}; }
    if (text === 'COMMIT' || text === 'ROLLBACK') { this.inTx=false; return {rows:[],rowCount:0}; }
    if (text.startsWith('INSERT INTO sif_stream_heads')) { const s=String(values[0]); if(!this.heads.has(s))this.heads.set(s,0); return {rows:[],rowCount:1}; }
    if (text.includes('SELECT stream_version FROM sif_stream_heads')) { const s=String(values[0]); return {rows:[{stream_version:this.heads.get(s)??0} as T],rowCount:1}; }
    if (text.includes('SELECT event_digest FROM sif_events WHERE stream_id')) { const s=String(values[0]); const v=Number(values[1]); const row=this.events.find(e=>e.stream_id===s&&Number(e.stream_version)===v); return {rows:row?[{event_digest:row.event_digest} as T]:[],rowCount:row?1:0}; }
    if (text.startsWith('INSERT INTO sif_events')) { const [stream_id,stream_version,event_id,event_type,occurred_at,observed_at,effective_at,actor_id,correlation_id,causation_id,payload,metadata,event_digest,previous_digest]=values; this.events.push({stream_id,stream_version,event_id,event_type,occurred_at,observed_at,effective_at,actor_id,correlation_id,causation_id,payload:JSON.parse(String(payload)),metadata:JSON.parse(String(metadata)),event_digest,previous_digest}); return {rows:[],rowCount:1}; }
    if (text.startsWith('UPDATE sif_stream_heads')) { this.heads.set(String(values[0]),Number(values[1])); return {rows:[],rowCount:1}; }
    if (text.startsWith('INSERT INTO sif_artifacts')) return {rows:[],rowCount:1};
    if (text.startsWith('SELECT * FROM sif_artifacts')) return {rows:[],rowCount:0};
    if (text.startsWith('INSERT INTO sif_projection_checkpoints')) return {rows:[],rowCount:1};
    if (text.startsWith('SELECT * FROM sif_projection_checkpoints')) return {rows:[],rowCount:0};
    if (text.startsWith('INSERT INTO sif_outbox')) { const [outbox_id,event_id,destination,payload_digest,created_at]=values; const exists=this.outbox.some(x=>x.event_id===event_id&&x.destination===destination); if(exists)return {rows:[],rowCount:0}; const row={outbox_id,event_id,destination,payload_digest,created_at,attempts:0,delivered_at:null}; this.outbox.push(row); return {rows:[row as T],rowCount:1}; }
    throw new Error(`Unhandled SQL: ${text}`);
  }
}
function ev(v:number): EventEnvelope { return {eventId:`e${v}`,eventType:'X',streamId:'s',streamVersion:v,occurredAt:'2026-09-16T00:00:00.000Z',observedAt:'2026-09-16T00:00:00.000Z',actorId:'a',correlationId:'c',payload:{v}}; }

test('ReplayEngine produces deterministic projection digest and detects gaps', () => { const store=new InMemoryEventStore(); const writer=new SifEventWriter(store); writer.write({streamId:'s',eventType:'Set',actorId:'a',correlationId:'c',payload:{value:1}}); writer.write({streamId:'s',eventType:'Set',actorId:'a',correlationId:'c',payload:{value:2}}); const replay=new ReplayEngine(store).replay('s',{initial:()=>({value:0}),apply:(state,e)=>({value:Number((e.payload as {value:number}).value)+0})}); assert.equal(replay.state.value,2); assert.equal(replay.stateDigest,digest({value:2})); });
test('ArtifactMetadataRegistry indexes metadata by content digest', () => { const r=new ArtifactMetadataRegistry(); const a=r.register({mediaType:'application/json',size:5,labels:{kind:'test'},bytesDigest:'a'.repeat(64)}); assert.equal(r.get(a.digest)?.mediaType,'application/json'); });
test('Postgres transactional store serializes appends through a stream-head row', async () => { const client=new FakeTx(); const pool={connect:async()=>({...client,query:client.query.bind(client),release(){}})} as any; const store=new PostgresTransactionalEventStore(pool); await store.appendAndEnqueue(ev(1),{expectedStreamVersion:0},['A']); let rejected=false; try{await store.appendAndEnqueue(ev(3),{expectedStreamVersion:1},['A']);}catch(error){rejected=/current=1/.test(String((error as Error).message));} assert.equal(rejected,true); await store.appendAndEnqueue(ev(2),{expectedStreamVersion:1},['A']); assert.equal(client.heads.get('s'),2); assert.equal(client.events.length,2); assert.equal(client.outbox.length,2); });
test('Postgres metadata and projection checkpoint stores expose durable contracts', async () => { const client=new FakeTx(); const { PostgresArtifactMetadataStore, PostgresProjectionCheckpointStore }=await import('../src/postgres.js'); const artifacts=new PostgresArtifactMetadataStore(client); await artifacts.put({digest:'a'.repeat(64),mediaType:'application/json',sizeBytes:10,createdAt:'2026-09-16T00:00:00.000Z',labels:{kind:'test'}}); assert.equal(await artifacts.get('missing'),undefined); const checkpoints=new PostgresProjectionCheckpointStore(client); await checkpoints.save({projectionId:'p',streamId:'s',streamVersion:2,stateDigest:'b'.repeat(64),updatedAt:'2026-09-16T00:00:00.000Z'}); assert.equal(await checkpoints.get('p','s'),undefined); });
