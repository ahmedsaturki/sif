import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryEventStore, SifEventWriter, digest } from '../src/index.js';
import { ResumableProjection } from '../src/projector.js';
import { PostgresInbox, PostgresOutboxWorker, consumeIdempotently } from '../src/worker.js';
import type { PgClientLike, PgPoolLike } from '../src/postgres.js';
import type { EventEnvelope } from '../src/types.js';
import type { ProjectionCheckpoint } from '../src/replay.js';

type Row = Record<string, unknown>;
class FakeDb implements PgClientLike {
  inbox=new Map<string,Row>(); checkpoints=new Map<string,Row>();
  outbox:Row[]=[
    {outbox_id:'o1',event_id:'e1',destination:'A',payload_digest:'a'.repeat(64),created_at:'2026-09-16T00:00:00.000Z',attempts:0,delivered_at:null,leased_until:null,last_error:null,lease_owner:null},
    {outbox_id:'o2',event_id:'e2',destination:'B',payload_digest:'b'.repeat(64),created_at:'2026-09-16T00:01:00.000Z',attempts:1,delivered_at:null,leased_until:null,last_error:'timeout',lease_owner:null}
  ];
  async query<T=Row>(text:string,values:readonly unknown[]=[]):Promise<{rows:T[];rowCount:number}> {
    if(text==='BEGIN'||text==='COMMIT'||text==='ROLLBACK')return {rows:[],rowCount:0};
    if(text.startsWith('WITH candidates AS')){const now=Date.parse(String(values[0])),limit=Number(values[1]),until=String(values[2]),owner=String(values[3]);const rows=this.outbox.filter(r=>!r.delivered_at&&(!r.leased_until||Date.parse(String(r.leased_until))<=now)).slice(0,limit);for(const r of rows){r.leased_until=until;r.lease_owner=owner;}return {rows:rows as T[],rowCount:rows.length};}
    if(text.startsWith('UPDATE sif_outbox')&&text.includes('attempts = attempts + 1')){const id=String(values[0]),owner=String(values[1]);const r=this.outbox.find(x=>x.outbox_id===id&&x.lease_owner===owner&&!x.delivered_at);if(!r)return {rows:[],rowCount:0};r.attempts=Number(r.attempts)+1;r.last_error=values[2]??null;r.leased_until=null;r.lease_owner=null;return {rows:[],rowCount:1};}
    if(text.startsWith('UPDATE sif_outbox')&&text.includes('delivered_at =')){const id=String(values[0]),owner=String(values[1]);const r=this.outbox.find(x=>x.outbox_id===id&&x.lease_owner===owner&&!x.delivered_at);if(!r)return {rows:[],rowCount:0};r.delivered_at=values[2];r.leased_until=null;r.lease_owner=null;r.last_error=null;return {rows:[],rowCount:1};}
    if(text.startsWith('INSERT INTO sif_inbox')){const key=`${values[1]}:${values[0]}`;if(this.inbox.has(key))return {rows:[],rowCount:0};this.inbox.set(key,{message_id:values[0],consumer_id:values[1],received_at:values[2],completed_at:null,result_digest:null});return {rows:[],rowCount:1};}
    if(text.startsWith('UPDATE sif_inbox')){const key=`${values[1]}:${values[0]}`,r=this.inbox.get(key);if(!r)return {rows:[],rowCount:0};r.completed_at=values[2];r.result_digest=values[3];return {rows:[],rowCount:1};}
    if(text.startsWith('DELETE FROM sif_inbox')){const key=`${values[1]}:${values[0]}`,existed=this.inbox.delete(key);return {rows:[],rowCount:existed?1:0};}
    if(text.startsWith('INSERT INTO sif_projection_checkpoints')){this.checkpoints.set(`${values[0]}:${values[1]}`,{projection_id:values[0],stream_id:values[1],stream_version:values[2],state_digest:values[3],updated_at:values[4]});return {rows:[],rowCount:1};}
    if(text.startsWith('SELECT * FROM sif_projection_checkpoints')){const r=this.checkpoints.get(`${values[0]}:${values[1]}`);return {rows:r?[r as T]:[],rowCount:r?1:0};}
    throw new Error(`Unhandled SQL: ${text}`);
  }
}
class FakePool extends FakeDb { async connect():Promise<PgClientLike&{release?:()=>void;query:PgClientLike['query']}>{return{query:this.query.bind(this),release(){}};} }
function event(v:number):EventEnvelope{return{eventId:`e${v}`,eventType:'set',streamId:'s',streamVersion:v,occurredAt:'2026-09-16T00:00:00.000Z',observedAt:'2026-09-16T00:00:00.000Z',actorId:'a',correlationId:'c',payload:{value:v}};}

test('ResumableProjection checkpoints new versions and remains deterministic',async()=>{const store=new InMemoryEventStore();const writer=new SifEventWriter(store);writer.write({streamId:'s',eventType:'set',actorId:'a',correlationId:'c',payload:{value:1}});writer.write({streamId:'s',eventType:'set',actorId:'a',correlationId:'c',payload:{value:2}});const db=new FakeDb();const cps={save:(c:ProjectionCheckpoint)=>db.query('INSERT INTO sif_projection_checkpoints',[c.projectionId,c.streamId,c.streamVersion,c.stateDigest,c.updatedAt]).then(()=>undefined),get:(p:string,s:string)=>db.query<Row>('SELECT * FROM sif_projection_checkpoints',[p,s]).then(r=>r.rows[0]?({projectionId:String(r.rows[0].projection_id),streamId:String(r.rows[0].stream_id),streamVersion:Number(r.rows[0].stream_version),stateDigest:String(r.rows[0].state_digest),updatedAt:String(r.rows[0].updated_at)}):undefined)};const runner=new ResumableProjection(store,cps,'p',()=>({value:0}),(state,e)=>({value:Number((e.payload as {value:number}).value)}));const first=await runner.run('s');assert.equal(first.applied,2);assert.equal(first.state.value,2);writer.write({streamId:'s',eventType:'set',actorId:'a',correlationId:'c',payload:{value:3}});const second=await runner.run('s');assert.equal(second.applied,1);assert.equal(second.state.value,3);assert.equal(second.checkpoint.stateDigest,digest({value:3}));});

test('PostgresOutboxWorker leases, retries, and marks delivery only for its owner',async()=>{const db=new FakePool();const worker=new PostgresOutboxWorker(db as unknown as PgPoolLike);const claimed=await worker.claim({limit:2,leaseUntil:'2026-09-16T01:00:00.000Z',workerId:'w1',now:'2026-09-16T00:30:00.000Z'});assert.equal(claimed.length,2);assert.equal(claimed[0]?.leasedBy,'w1');await worker.markAttempt('o1','w1','temporary failure');await worker.markDelivered('o2','w1','2026-09-16T00:31:00.000Z');assert.equal(Number(db.outbox.find(x=>x.outbox_id==='o1')?.attempts),1);assert.equal(db.outbox.find(x=>x.outbox_id==='o2')?.delivered_at,'2026-09-16T00:31:00.000Z');});

test('PostgresInbox makes successful consumption idempotent and failed handling retryable',async()=>{const db=new FakeDb();const inbox=new PostgresInbox(db);let calls=0;const okEvent=event(1);const first=await consumeIdempotently<{ok:boolean}>({inbox,event:okEvent,consumerId:'c1',handler:{handle:()=>{calls+=1;return{ok:true};}}});const second=await consumeIdempotently<{ok:boolean}>({inbox,event:okEvent,consumerId:'c1',handler:{handle:()=>{calls+=1;return{ok:true};}}});assert.equal(first.applied,true);assert.equal(second.applied,false);assert.equal(calls,1);const failEvent=event(2);let failed=false;try{await consumeIdempotently<never>({inbox,event:failEvent,consumerId:'c1',handler:{handle:()=>{throw new Error('boom');}}});}catch{failed=true;}assert.equal(failed,true);const retried=await consumeIdempotently<{recovered:boolean}>({inbox,event:failEvent,consumerId:'c1',handler:{handle:()=>({recovered:true})}});assert.equal(retried.applied,true);});
