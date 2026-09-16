# SIF Core 0.5.0 — Implementation Status

## Verified

- TypeScript strict build passes.
- 27 tests pass.
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

## Local verification

```text
TypeScript build: PASS
Test suite: 27/27 PASS
Failed: 0
Skipped: 0
```

## Not claimed as live-verified here

- Real PostgreSQL wire/runtime concurrency.
- TLS/mTLS/SPIFFE federation transport.
- OPA/Cedar adapter.
- KMS/HSM secret integration.
- Distributed consensus.
- Production OpenTelemetry exporter.
- Exactly-once external side effects.

These remain explicit adapters/integration stages rather than hidden assumptions.

## Delivery boundary

The durable delivery model is at-least-once. Exactly-once external effects require transactional participation by the side effect or independently idempotent consumers.
