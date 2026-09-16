# SIF Core 0.5.0 + Live PostgreSQL Verification

## Verified kernel

- TypeScript strict build passes.
- 27 unit/in-memory tests pass.
- ReplayEngine produces deterministic state digests and rejects stream gaps.
- ArtifactMetadataRegistry provides digest-keyed metadata.
- PostgreSQL transactional append uses a dedicated per-stream head row with `FOR UPDATE`, avoiding the empty-set `MAX(...)` locking problem.
- Event and outbox rows are committed in one transaction.
- Outbox uniqueness remains `(event_id, destination)`.
- PostgreSQL schema includes stream heads, events, outbox, artifact metadata, and projection checkpoints.
- PostgreSQL artifact metadata and projection checkpoint runtime contracts are implemented.
- Durable PostgreSQL outbox leasing/reclaim semantics are implemented by contract.
- PostgreSQL inbox idempotency with retryable failure cleanup is implemented by contract.
- Resumable projection runner with persisted checkpoints is implemented by contract.

## Live PostgreSQL verification — 0.6 milestone

GitHub Actions run 64 executed against a real PostgreSQL 16 service and passed the live integration step using the compiled `PostgresTransactionalEventStore` implementation through a dependency-free PostgreSQL wire-protocol test harness.

Verified behavior:

- two independent PostgreSQL connections concurrently target the same stream at version 1;
- the `sif_stream_heads ... FOR UPDATE` serialization point admits exactly one writer for the expected version;
- the losing writer observes the post-lock version mismatch and is rejected rather than creating a conflicting event;
- exactly one event and one durable outbox row remain for the test stream;
- cleanup is performed after verification.

This verifies live database connectivity and the core per-stream transactional serialization path. It does not establish production-scale performance, network fault tolerance, or exactly-once external side effects.

## Local verification

```text
TypeScript build: PASS
Test suite: 27/27 PASS
Failed: 0
Skipped: 0
```

## Not claimed as live-verified

- TLS/mTLS/SPIFFE federation transport.
- OPA/Cedar adapter.
- KMS/HSM secret integration.
- Distributed consensus.
- Production OpenTelemetry exporter.
- Exactly-once external side effects.
- Production-scale PostgreSQL performance/HA characterization.

These remain explicit adapters or verification stages rather than hidden assumptions.

## Delivery boundary

The durable delivery model is at-least-once. Exactly-once external effects require transactional participation by the side effect or independently idempotent consumers.
