import type { EventEnvelope } from "./types.js";
import type { OutboxItem } from "./outbox.js";
import { digest, IntegrityError, now } from "./core.js";
import type { PgClientLike, PgPoolLike } from "./postgres.js";

export interface ClaimedOutboxItem extends OutboxItem { leasedBy: string; }

function rowToOutbox(row: Record<string, unknown>, workerId?: string): ClaimedOutboxItem {
  return { outboxId: String(row.outbox_id), eventId: String(row.event_id), destination: String(row.destination), payloadDigest: String(row.payload_digest), createdAt: new Date(String(row.created_at)).toISOString(), attempts: Number(row.attempts), ...(row.delivered_at == null ? {} : { deliveredAt: new Date(String(row.delivered_at)).toISOString() }), ...(row.leased_until == null ? {} : { leasedUntil: new Date(String(row.leased_until)).toISOString() }), ...(row.last_error == null ? {} : { lastError: String(row.last_error) }), leasedBy: workerId ?? String(row.leased_by ?? "") };
}

export interface OutboxLeaseOptions { limit: number; leaseUntil: string; workerId: string; now?: string; }

export class PostgresOutboxWorker {
  constructor(private readonly pool: PgPoolLike) {}
  async claim(options: OutboxLeaseOptions): Promise<ClaimedOutboxItem[]> {
    if (!Number.isInteger(options.limit) || options.limit < 1) throw new RangeError("limit must be >= 1");
    const currentTime = options.now ?? now();
    const tx = await this.pool.connect();
    try {
      await tx.query("BEGIN");
      const result = await tx.query<Record<string, unknown>>(`WITH candidates AS (SELECT outbox_id FROM sif_outbox WHERE delivered_at IS NULL AND (leased_until IS NULL OR leased_until <= $1) ORDER BY created_at, outbox_id FOR UPDATE SKIP LOCKED LIMIT $2) UPDATE sif_outbox o SET leased_until = $3, lease_owner = $4 FROM candidates c WHERE o.outbox_id = c.outbox_id RETURNING o.outbox_id, o.event_id, o.destination, o.payload_digest, o.created_at, o.attempts, o.delivered_at, o.leased_until, o.last_error, o.lease_owner AS leased_by`, [currentTime, options.limit, options.leaseUntil, options.workerId]);
      await tx.query("COMMIT");
      return result.rows.map(row => rowToOutbox(row, options.workerId));
    } catch (error) { try { await tx.query("ROLLBACK"); } catch { /* preserve original */ } throw error; }
    finally { tx.release?.(); }
  }

  async markAttempt(outboxId: string, workerId: string, errorMessage?: string): Promise<void> {
    await this.pool.query(`UPDATE sif_outbox SET attempts = attempts + 1, last_error = $3, leased_until = NULL, lease_owner = NULL WHERE outbox_id = $1 AND lease_owner = $2 AND delivered_at IS NULL`, [outboxId, workerId, errorMessage ?? null]);
  }

  async markDelivered(outboxId: string, workerId: string, at = now()): Promise<void> {
    await this.pool.query(`UPDATE sif_outbox SET delivered_at = $3, leased_until = NULL, lease_owner = NULL, last_error = NULL WHERE outbox_id = $1 AND lease_owner = $2 AND delivered_at IS NULL`, [outboxId, workerId, at]);
  }
}

export interface InboxClaim { consumerId: string; messageId: string; }

export class PostgresInbox {
  constructor(private readonly client: PgClientLike) {}
  async begin(messageId: string, consumerId: string, receivedAt = now()): Promise<boolean> {
    const result = await this.client.query(`INSERT INTO sif_inbox (message_id, consumer_id, received_at) VALUES ($1,$2,$3) ON CONFLICT (consumer_id, message_id) DO NOTHING`, [messageId, consumerId, receivedAt]);
    return result.rowCount === 1;
  }
  async complete(messageId: string, consumerId: string, resultDigest: string, completedAt = now()): Promise<void> {
    const result = await this.client.query(`UPDATE sif_inbox SET completed_at = $3, result_digest = $4 WHERE message_id = $1 AND consumer_id = $2`, [messageId, consumerId, completedAt, resultDigest]);
    if (result.rowCount !== 1) throw new IntegrityError(`Inbox completion missing claim for ${consumerId}:${messageId}`);
  }
  async abandon(messageId: string, consumerId: string): Promise<void> { await this.client.query(`DELETE FROM sif_inbox WHERE message_id = $1 AND consumer_id = $2 AND completed_at IS NULL`, [messageId, consumerId]); }
}

export interface IdempotentEventHandler<T = unknown> { handle(event: EventEnvelope): Promise<T> | T; }

export async function consumeIdempotently<T>(args: { inbox: PostgresInbox; event: EventEnvelope; consumerId: string; handler: IdempotentEventHandler<T>; }): Promise<{ applied: boolean; result?: T; resultDigest?: string }> {
  const accepted = await args.inbox.begin(args.event.eventId, args.consumerId);
  if (!accepted) return { applied: false };
  try {
    const result = await args.handler.handle(args.event);
    const resultDigest = digest(result);
    await args.inbox.complete(args.event.eventId, args.consumerId, resultDigest);
    return { applied: true, result, resultDigest };
  } catch (error) {
    await args.inbox.abandon(args.event.eventId, args.consumerId);
    throw new IntegrityError(`Consumer ${args.consumerId} failed for message ${args.event.eventId}: ${String(error)}`);
  }
}
