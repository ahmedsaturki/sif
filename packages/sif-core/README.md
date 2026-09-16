# SIF Core 0.5.0

Dependency-free TypeScript kernel for a Sovereign Intelligence Fabric.

## Included

- append-only event streams with optimistic concurrency
- deterministic replay and projections
- SHA-256 event integrity / stream hash chains
- filesystem content-addressed storage (CAS)
- evidence / provenance / semantic registries
- scoped, expiring authority and attenuating delegation
- default-deny policy admission with deny-overrides
- durable JSONL outbox
- transactional PostgreSQL event + outbox adapter
- per-stream PostgreSQL serialization via `sif_stream_heads` row locking
- PostgreSQL artifact metadata / projection checkpoint schema
- Ed25519 attestations
- lineage / reconstruction verification
- capability-gated execution
- durable outbox leasing/reclaim and inbox idempotency primitives
- resumable projections

## Verification

```text
TypeScript build: PASS
Tests: 27/27 PASS
Failed: 0
Skipped: 0
```

The PostgreSQL adapter is verified against typed client contracts and transaction/failure behavior using integration fakes. A live PostgreSQL server/driver was not available in this environment, so live database concurrency is not claimed as verified.

## Guarantees and boundaries

- Durable PostgreSQL outbox leasing uses `FOR UPDATE SKIP LOCKED` with an explicit `lease_owner`; expired leases can be reclaimed.
- PostgreSQL inbox deduplicates `(consumer_id, message_id)` and removes an incomplete claim on handler failure so transient failures remain retryable.
- Resumable projections persist a checkpoint after applying new events and verify contiguous stream versions.
- Event history remains the authoritative source; projections and checkpoints are derived state.
- Delivery is at-least-once. Exactly-once external side effects require the side effect and inbox completion to participate in the same transaction or be made independently idempotent.

See `docs/ARCHITECTURE.md`, `IMPLEMENTATION_STATUS.md`, and `sql/postgres-schema.sql`.
