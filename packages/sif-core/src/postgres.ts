import type { AppendCondition, EventEnvelope } from './types.js';
import { ConcurrencyError, IntegrityError } from './core.js';
import { eventDigest } from './integrity.js';
import type { OutboxItem } from './outbox.js';
import { cryptoRandomId, digest, now } from './core.js';

export interface PgResult<T = Record<string, unknown>> { rows: T[]; rowCount: number; }
export interface PgClientLike {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PgResult<T>>;
}
export interface PgPoolLike extends PgClientLike {
  connect(): Promise<PgClientLike & { release?: () => void; query: PgClientLike['query'] }>;
}

export interface PostgresOutboxItem extends OutboxItem {}
export interface PostgresEventStoreOptions { table?: string; }

function rowToEvent(row: Record<string, unknown>): EventEnvelope {
  const metadata = row.metadata as Record<string, string> | null | undefined;
  return {
    eventId: String(row.event_id), eventType: String(row.event_type), streamId: String(row.stream_id), streamVersion: Number(row.stream_version),
    occurredAt: new Date(String(row.occurred_at)).toISOString(), observedAt: new Date(String(row.observed_at)).toISOString(),
    ...(row.effective_at == null ? {} : { effectiveAt: new Date(String(row.effective_at)).toISOString() }), actorId: String(row.actor_id), correlationId: String(row.correlation_id),
    ...(row.causation_id == null ? {} : { causationId: String(row.causation_id) }), payload: structuredClone((row.payload ?? {}) as Record<string, unknown>),
    ...(metadata && Object.keys(metadata).length ? { metadata: structuredClone(metadata) } : {})
  };
}

function assertCanonicalEvent(event: EventEnvelope): void {
  if (!event.eventId || !event.streamId || !event.eventType || !event.actorId || !event.correlationId) throw new IntegrityError('Event identity fields are required');
  if (!Number.isInteger(event.streamVersion) || event.streamVersion < 1) throw new IntegrityError('streamVersion must be a positive integer');
}

export class PostgresEventStore {
  constructor(private readonly client: PgClientLike, private readonly options: PostgresEventStoreOptions = {}) {}

  async append<T extends Record<string, unknown>>(event: EventEnvelope<T>, condition: AppendCondition): Promise<void> {
    assertCanonicalEvent(event);
    const result = await this.client.query<{ stream_version: number }>('SELECT COALESCE(MAX(stream_version), 0)::bigint AS stream_version FROM sif_events WHERE stream_id = $1', [event.streamId]);
    const current = Number(result.rows[0]?.stream_version ?? 0);
    if (current !== condition.expectedStreamVersion || event.streamVersion !== current + 1) throw new ConcurrencyError(`Stream ${event.streamId} expected ${condition.expectedStreamVersion}; current=${current}; event=${event.streamVersion}`);
    const previous = await this.client.query<{ event_digest: string }>('SELECT event_digest FROM sif_events WHERE stream_id = $1 ORDER BY stream_version DESC LIMIT 1', [event.streamId]);
    const previousDigest = previous.rows[0]?.event_digest;
    const eventDigestValue = eventDigest(event, previousDigest);
    await this.client.query(`INSERT INTO sif_events (stream_id, stream_version, event_id, event_type, occurred_at, observed_at, effective_at, actor_id, correlation_id, causation_id, payload, metadata, event_digest, previous_digest) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14)`, [event.streamId, event.streamVersion, event.eventId, event.eventType, event.occurredAt, event.observedAt, event.effectiveAt ?? null, event.actorId, event.correlationId, event.causationId ?? null, JSON.stringify(event.payload), JSON.stringify(event.metadata ?? {}), eventDigestValue, previousDigest]);
  }

  async read(streamId: string, fromVersion = 1): Promise<EventEnvelope[]> {
    const result = await this.client.query('SELECT * FROM sif_events WHERE stream_id = $1 AND stream_version >= $2 ORDER BY stream_version ASC', [streamId, fromVersion]);
    return result.rows.map(rowToEvent);
  }
  async all(): Promise<EventEnvelope[]> { const result = await this.client.query('SELECT * FROM sif_events ORDER BY created_at ASC, stream_id ASC, stream_version ASC'); return result.rows.map(rowToEvent); }
  async streamVersion(streamId: string): Promise<number> { const result = await this.client.query<{ stream_version: number }>('SELECT COALESCE(MAX(stream_version),0)::bigint AS stream_version FROM sif_events WHERE stream_id = $1', [streamId]); return Number(result.rows[0]?.stream_version ?? 0); }
}

export interface PostgresTransactionalAppend { appendAndEnqueue<T extends Record<string, unknown>>(event: EventEnvelope<T>, condition: AppendCondition, destinations: readonly string[]): Promise<PostgresOutboxItem[]>; }

export class PostgresTransactionalEventStore extends PostgresEventStore implements PostgresTransactionalAppend {
  constructor(private readonly pool: PgPoolLike) { super(pool); }

  async appendAndEnqueue<T extends Record<string, unknown>>(event: EventEnvelope<T>, condition: AppendCondition, destinations: readonly string[]): Promise<PostgresOutboxItem[]> {
    assertCanonicalEvent(event);
    const tx = await this.pool.connect();
    try {
      await tx.query('BEGIN');
      await tx.query('INSERT INTO sif_stream_heads (stream_id, stream_version) VALUES ($1,0) ON CONFLICT (stream_id) DO NOTHING', [event.streamId]);
      const head = await tx.query<{ stream_version: number }>('SELECT stream_version FROM sif_stream_heads WHERE stream_id = $1 FOR UPDATE', [event.streamId]);
      const current = Number(head.rows[0]?.stream_version ?? 0);
      if (current !== condition.expectedStreamVersion || event.streamVersion !== current + 1) throw new ConcurrencyError(`Stream ${event.streamId} expected ${condition.expectedStreamVersion}; current=${current}; event=${event.streamVersion}`);
      const previousDigest = current === 0 ? undefined : (await tx.query<{ event_digest: string }>('SELECT event_digest FROM sif_events WHERE stream_id = $1 AND stream_version = $2', [event.streamId, current])).rows[0]?.event_digest;
      const eventDigestValue = eventDigest(event, previousDigest);
      await tx.query(`INSERT INTO sif_events (stream_id, stream_version, event_id, event_type, occurred_at, observed_at, effective_at, actor_id, correlation_id, causation_id, payload, metadata, event_digest, previous_digest) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14)`, [event.streamId, event.streamVersion, event.eventId, event.eventType, event.occurredAt, event.observedAt, event.effectiveAt ?? null, event.actorId, event.correlationId, event.causationId ?? null, JSON.stringify(event.payload), JSON.stringify(event.metadata ?? {}), eventDigestValue, previousDigest]);
      await tx.query('UPDATE sif_stream_heads SET stream_version = $2, updated_at = NOW() WHERE stream_id = $1', [event.streamId, event.streamVersion]);
      const items: PostgresOutboxItem[] = [];
      for (const destination of destinations) {
        const outboxId = cryptoRandomId();
        const payloadDigest = digest(event.payload);
        const result = await tx.query<Record<string, unknown>>(`INSERT INTO sif_outbox (outbox_id,event_id,destination,payload_digest,attempts) VALUES ($1,$2,$3,$4,0) ON CONFLICT (event_id,destination) DO UPDATE SET event_id=EXCLUDED.event_id RETURNING outbox_id,event_id,destination,payload_digest,created_at,attempts,delivered_at,leased_until,last_error,lease_owner`, [outboxId,event.eventId,destination,payloadDigest]);
        const row=result.rows[0]; if (!row) throw new IntegrityError('Outbox insert returned no row');
        items.push({outboxId:String(row.outbox_id),eventId:String(row.event_id),destination:String(row.destination),payloadDigest:String(row.payload_digest),createdAt:new Date(String(row.created_at)).toISOString(),attempts:Number(row.attempts),...(row.delivered_at==null?{}:{deliveredAt:new Date(String(row.delivered_at)).toISOString()}),...(row.leased_until==null?{}:{leasedUntil:new Date(String(row.leased_until)).toISOString()}),...(row.last_error==null?{}:{lastError:String(row.last_error)})});
      }
      await tx.query('COMMIT');
      return items;
    } catch (error) { try { await tx.query('ROLLBACK'); } catch { /* preserve original */ } throw error; }
    finally { tx.release?.(); }
  }
}

export interface PostgresArtifactMetadataRecord { digest: string; mediaType: string; size: number; createdAt: string; source?: string; provenanceId?: string; labels: Record<string,string>; }
export interface PostgresProjectionCheckpointRecord { projectionId:string; streamId:string; streamVersion:number; stateDigest:string; updatedAt:string; }

export class PostgresMetadataStore {
  constructor(private readonly client: PgClientLike) {}
  async putArtifact(record: PostgresArtifactMetadataRecord): Promise<void> { await this.client.query(`INSERT INTO sif_artifact_metadata (digest,media_type,size,created_at,source,provenance_id,labels) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (digest) DO UPDATE SET media_type=EXCLUDED.media_type,size=EXCLUDED.size,source=EXCLUDED.source,provenance_id=EXCLUDED.provenance_id,labels=EXCLUDED.labels`, [record.digest,record.mediaType,record.size,record.createdAt,record.source??null,record.provenanceId??null,JSON.stringify(record.labels)]); }
  async saveCheckpoint(checkpoint: PostgresProjectionCheckpointRecord): Promise<void> { await this.client.query(`INSERT INTO sif_projection_checkpoints (projection_id,stream_id,stream_version,state_digest,updated_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (projection_id,stream_id) DO UPDATE SET stream_version=EXCLUDED.stream_version,state_digest=EXCLUDED.state_digest,updated_at=EXCLUDED.updated_at`, [checkpoint.projectionId,checkpoint.streamId,checkpoint.streamVersion,checkpoint.stateDigest,checkpoint.updatedAt]); }
  async getCheckpoint(projectionId:string, streamId:string): Promise<PostgresProjectionCheckpointRecord|undefined> { const result=await this.client.query<Record<string,unknown>>('SELECT * FROM sif_projection_checkpoints WHERE projection_id = $1 AND stream_id = $2',[projectionId,streamId]); const row=result.rows[0]; if(!row)return undefined; return {projectionId:String(row.projection_id),streamId:String(row.stream_id),streamVersion:Number(row.stream_version),stateDigest:String(row.state_digest),updatedAt:new Date(String(row.updated_at)).toISOString()}; }
}
