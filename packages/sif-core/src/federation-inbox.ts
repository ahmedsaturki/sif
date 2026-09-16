import { digest, now } from "./core.js";
import type { FederationEnvelope } from "./federation-envelope.js";
import type { PgPoolLike, PgClientLike } from "./postgres.js";
import { FederationProtocolError } from "./federation-envelope.js";

export type FederatedInboxState = "DELIVERED" | "PROCESSED" | "COMMITTED" | "VERIFIED";

export interface FederatedInboxRecord {
  consumerId: string;
  messageId: string;
  senderDomain: string;
  replayKey: string;
  state: FederatedInboxState;
  receivedAt: string;
  processedAt?: string;
  committedAt?: string;
  verifiedAt?: string;
  resultDigest?: string;
}

export interface FederatedInboxClaim {
  accepted: boolean;
  duplicate: boolean;
  record: FederatedInboxRecord;
}

export interface FederatedEffectContext {
  record: FederatedInboxRecord;
  envelope: FederationEnvelope;
}

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
}

function assertDate(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${name} must be a valid ISO date`);
}

function clone(record: FederatedInboxRecord): FederatedInboxRecord {
  return { ...record };
}

function validateEnvelopeIdentity(envelope: FederationEnvelope): void {
  assertNonEmpty("envelope.messageId", envelope.messageId);
  assertNonEmpty("envelope.sender.domain", envelope.sender.domain);
  assertNonEmpty("envelope.replayNonce", envelope.replayNonce);
}

function logicalReplayKey(senderDomain: string, replayNonce: string): string {
  return `${senderDomain}\u0000${replayNonce}`;
}

function durableReplayKeyHash(senderDomain: string, replayNonce: string): string {
  return digest({ purpose: "sif-federation-replay-key-v1", senderDomain, replayNonce });
}

function isReplayConstraintError(error: unknown): boolean {
  if ((error as { code?: unknown }).code === "23505") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate key value violates unique constraint.*sif_federated_inbox.*replay_key/i.test(message);
}

export class InMemoryFederatedInbox {
  private readonly records = new Map<string, FederatedInboxRecord>();

  accept(envelope: FederationEnvelope, consumerId: string, receivedAt = envelope.time.observedAt): FederatedInboxClaim {
    validateEnvelopeIdentity(envelope);
    assertNonEmpty("consumerId", consumerId);
    assertDate("receivedAt", receivedAt);
    const key = `${consumerId}\u0000${envelope.messageId}`;
    const replayKey = logicalReplayKey(envelope.sender.domain, envelope.replayNonce);
    const existing = this.records.get(key);
    if (existing) {
      if (existing.senderDomain !== envelope.sender.domain || existing.replayKey !== replayKey) {
        throw new FederationProtocolError("INTEGRITY_FAILURE", "Message identity collision does not match original sender/replay binding");
      }
      return { accepted: false, duplicate: true, record: clone(existing) };
    }
    for (const record of this.records.values()) {
      if (record.consumerId === consumerId && record.replayKey === replayKey && record.messageId !== envelope.messageId) {
        throw new FederationProtocolError("REPLAY_DETECTED", "Replay key is already bound to a different message identity");
      }
    }
    const record: FederatedInboxRecord = {
      consumerId,
      messageId: envelope.messageId,
      senderDomain: envelope.sender.domain,
      replayKey,
      state: "DELIVERED",
      receivedAt,
    };
    this.records.set(key, record);
    return { accepted: true, duplicate: false, record: clone(record) };
  }

  markProcessed(consumerId: string, messageId: string, processedAt = now()): FederatedInboxRecord {
    return this.transition(consumerId, messageId, "DELIVERED", "PROCESSED", processedAt, "processedAt");
  }

  markCommitted(consumerId: string, messageId: string, resultDigest: string, committedAt = now()): FederatedInboxRecord {
    assertNonEmpty("resultDigest", resultDigest);
    const current = this.get(consumerId, messageId);
    if (current.state === "COMMITTED" || current.state === "VERIFIED") return current;
    const updated = this.transition(consumerId, messageId, "PROCESSED", "COMMITTED", committedAt, "committedAt");
    updated.resultDigest = resultDigest;
    this.records.set(`${consumerId}\u0000${messageId}`, updated);
    return clone(updated);
  }

  markVerified(consumerId: string, messageId: string, verifiedAt = now()): FederatedInboxRecord {
    const current = this.get(consumerId, messageId);
    if (current.state === "VERIFIED") return current;
    return this.transition(consumerId, messageId, "COMMITTED", "VERIFIED", verifiedAt, "verifiedAt");
  }

  get(consumerId: string, messageId: string): FederatedInboxRecord {
    const record = this.records.get(`${consumerId}\u0000${messageId}`);
    if (!record) throw new FederationProtocolError("REPLAY_DETECTED", "Federated inbox record not found");
    return clone(record);
  }

  private transition(
    consumerId: string,
    messageId: string,
    expected: FederatedInboxState,
    next: FederatedInboxState,
    at: string,
    field: "processedAt" | "committedAt" | "verifiedAt",
  ): FederatedInboxRecord {
    assertDate(field, at);
    const key = `${consumerId}\u0000${messageId}`;
    const current = this.records.get(key);
    if (!current) throw new FederationProtocolError("REPLAY_DETECTED", "Federated inbox record not found");
    if (current.state !== expected) {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Invalid inbox transition ${current.state} -> ${next}`);
    }
    const updated = { ...current, state: next, [field]: at } as FederatedInboxRecord;
    this.records.set(key, updated);
    return clone(updated);
  }
}

export class PostgresFederatedInbox {
  constructor(private readonly pool: PgPoolLike) {}

  async process(
    envelope: FederationEnvelope,
    consumerId: string,
    effect: (client: PgClientLike, context: FederatedEffectContext) => Promise<string>,
    receivedAt = envelope.time.observedAt,
  ): Promise<FederatedInboxClaim> {
    validateEnvelopeIdentity(envelope);
    assertNonEmpty("consumerId", consumerId);
    assertDate("receivedAt", receivedAt);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const claim = await this.claim(client, envelope, consumerId, receivedAt);
      if (!claim.accepted) {
        await client.query("ROLLBACK");
        return claim;
      }

      const processedAt = now();
      await client.query(
        "UPDATE sif_federated_inbox SET state = 'PROCESSED', processed_at = $3 WHERE consumer_id = $1 AND message_id = $2",
        [consumerId, envelope.messageId, processedAt],
      );
      const processed: FederatedInboxRecord = {
        ...claim.record,
        state: "PROCESSED",
        processedAt,
      };
      const result = await effect(client, { record: processed, envelope });
      assertNonEmpty("effect result digest", result);
      const committedAt = now();
      await client.query(
        "UPDATE sif_federated_inbox SET state = 'COMMITTED', committed_at = $3, result_digest = $4 WHERE consumer_id = $1 AND message_id = $2",
        [consumerId, envelope.messageId, committedAt, result],
      );
      await client.query("COMMIT");

      return {
        accepted: true,
        duplicate: false,
        record: {
          ...processed,
          state: "COMMITTED",
          committedAt,
          resultDigest: result,
        },
      };
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
      throw error;
    } finally {
      client.release?.();
    }
  }

  async markVerified(consumerId: string, messageId: string, verifiedAt = now()): Promise<FederatedInboxRecord> {
    assertNonEmpty("consumerId", consumerId);
    assertNonEmpty("messageId", messageId);
    assertDate("verifiedAt", verifiedAt);
    const result = await this.pool.query<Record<string, unknown>>(
      "UPDATE sif_federated_inbox SET state = 'VERIFIED', verified_at = $3 WHERE consumer_id = $1 AND message_id = $2 AND state = 'COMMITTED' RETURNING *",
      [consumerId, messageId, verifiedAt],
    );
    const row = result.rows[0];
    if (!row) return this.get(consumerId, messageId);
    return rowToRecord(row);
  }

  async get(consumerId: string, messageId: string): Promise<FederatedInboxRecord> {
    const result = await this.pool.query<Record<string, unknown>>(
      "SELECT * FROM sif_federated_inbox WHERE consumer_id = $1 AND message_id = $2",
      [consumerId, messageId],
    );
    const row = result.rows[0];
    if (!row) throw new FederationProtocolError("REPLAY_DETECTED", "Federated inbox record not found");
    return rowToRecord(row);
  }

  private async claim(client: PgClientLike, envelope: FederationEnvelope, consumerId: string, receivedAt: string): Promise<FederatedInboxClaim> {
    const replayKey = logicalReplayKey(envelope.sender.domain, envelope.replayNonce);
    const replayKeyHash = durableReplayKeyHash(envelope.sender.domain, envelope.replayNonce);
    try {
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO sif_federated_inbox (consumer_id, message_id, sender_domain, replay_nonce, replay_key_hash, state, received_at)
         VALUES ($1,$2,$3,$4,$5,'DELIVERED',$6)
         ON CONFLICT (consumer_id, message_id) DO NOTHING
         RETURNING consumer_id`,
        [consumerId, envelope.messageId, envelope.sender.domain, envelope.replayNonce, replayKeyHash, receivedAt],
      );
      if (inserted.rowCount > 0) {
        return {
          accepted: true,
          duplicate: false,
          record: {
            consumerId,
            messageId: envelope.messageId,
            senderDomain: envelope.sender.domain,
            replayKey,
            state: "DELIVERED",
            receivedAt,
          },
        };
      }
    } catch (error) {
      if (isReplayConstraintError(error)) {
        throw new FederationProtocolError("REPLAY_DETECTED", "Replay key is already bound to a different message identity");
      }
      throw error;
    }
    const existing = await client.query<Record<string, unknown>>(
      "SELECT * FROM sif_federated_inbox WHERE consumer_id = $1 AND message_id = $2 FOR UPDATE",
      [consumerId, envelope.messageId],
    );
    const row = existing.rows[0];
    if (!row) throw new FederationProtocolError("INTEGRITY_FAILURE", "Inbox conflict produced no durable record");
    const record = rowToRecord(row);
    if (record.senderDomain !== envelope.sender.domain || String(row.replay_key_hash) !== replayKeyHash) {
      throw new FederationProtocolError("INTEGRITY_FAILURE", "Message identity collision does not match original sender/replay binding");
    }
    return { accepted: false, duplicate: true, record };
  }
}

function rowToRecord(row: Record<string, unknown>): FederatedInboxRecord {
  const state = String(row.state) as FederatedInboxState;
  if (!["DELIVERED", "PROCESSED", "COMMITTED", "VERIFIED"].includes(state)) {
    throw new FederationProtocolError("INTEGRITY_FAILURE", `Unknown federated inbox state: ${state}`);
  }
  const senderDomain = String(row.sender_domain);
  const replayNonce = String(row.replay_nonce);
  const expectedHash = durableReplayKeyHash(senderDomain, replayNonce);
  if (String(row.replay_key_hash) !== expectedHash) {
    throw new FederationProtocolError("INTEGRITY_FAILURE", "Persisted replay-key hash does not match sender/replay identity");
  }
  return {
    consumerId: String(row.consumer_id),
    messageId: String(row.message_id),
    senderDomain,
    replayKey: logicalReplayKey(senderDomain, replayNonce),
    state,
    receivedAt: new Date(String(row.received_at)).toISOString(),
    ...(row.processed_at == null ? {} : { processedAt: new Date(String(row.processed_at)).toISOString() }),
    ...(row.committed_at == null ? {} : { committedAt: new Date(String(row.committed_at)).toISOString() }),
    ...(row.verified_at == null ? {} : { verifiedAt: new Date(String(row.verified_at)).toISOString() }),
    ...(row.result_digest == null ? {} : { resultDigest: String(row.result_digest) }),
  };
}

export function federatedEffectDigest(value: unknown): string {
  return digest(value);
}
