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

Live PostgreSQL integration (PostgreSQL 16): 4/4 PASS
  - concurrent same-stream append serialization
  - atomic rollback of event + stream head + outbox
  - projection checkpoint persistence / deterministic round-trip
  - exclusive outbox lease, expiry/reclaim, and owner fencing
```

The 0.6 integration milestone is verified in GitHub Actions using a real PostgreSQL 16 service and the compiled implementation through a dependency-free PostgreSQL wire-protocol harness. The live suite verifies database behavior rather than a mock-only contract.

## Guarantees and boundaries

- Durable PostgreSQL outbox leasing uses `FOR UPDATE SKIP LOCKED` with an explicit `lease_owner`; expired leases can be reclaimed.
- PostgreSQL inbox deduplicates `(consumer_id, message_id)` and removes an incomplete claim on handler failure so transient failures remain retryable.
- Resumable projections persist a checkpoint after applying new events and verify contiguous stream versions.
- Transactional append commits the event, stream head, and outbox records together; a database constraint failure rolls the transaction back as one unit.
- Event history remains the authoritative source; projections and checkpoints are derived state.
- Delivery is at-least-once. Exactly-once external side effects require the side effect and inbox completion to participate in the same transaction or be made independently idempotent.
- The package version remains `0.5.0`; the `0.6` label denotes the live PostgreSQL verification milestone, not a published package release.

## Verification boundaries

The following are not claimed as live-verified by this milestone: TLS/mTLS/SPIFFE transport, OPA/Cedar integration, KMS/HSM integration, distributed consensus, production OpenTelemetry export, exactly-once external side effects, and production-scale PostgreSQL performance/HA characterization.

See `docs/ARCHITECTURE.md`, `IMPLEMENTATION_STATUS.md`, and `sql/postgres-schema.sql`.
