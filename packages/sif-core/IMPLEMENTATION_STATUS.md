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
- Durable PostgreSQL outbox leasing/reclaim semantics are implemented by contract and live-verified below.
- PostgreSQL inbox idempotency with retryable failure cleanup is implemented by contract.
- Resumable projection runner with persisted checkpoints is implemented by contract and its checkpoint persistence is live-verified below.

## Live PostgreSQL verification — 0.6 milestone

GitHub Actions run 73 executed the committed tree against a real PostgreSQL 16 service and passed the complete live integration suite using the compiled implementation through a dependency-free PostgreSQL wire-protocol test harness.

Live scenarios verified:

1. **Concurrent same-stream append serialization** — two independent PostgreSQL connections contend for version 1; the stream-head row lock serializes the writers and exactly one event/outbox pair remains.
2. **Atomic rollback** — a constraint failure after event/head work causes PostgreSQL to roll back the event, stream head, and outbox together; no partial commit remains.
3. **Projection checkpoint lifecycle** — checkpoint state persists in PostgreSQL and round-trips deterministically for resumable projection progress.
4. **Outbox worker lifecycle** — leases are exclusive, expired leases are reclaimable, and delivery/attempt updates are fenced to the current lease owner.

The live integration result was **4/4 PASS**. The CI job also passed artifact identity verification, strict build, the 27-test unit suite, and PostgreSQL schema bootstrap.

This establishes live behavior for the covered PostgreSQL transaction, checkpoint, and worker-lease paths. It does not establish production-scale performance, database HA, arbitrary crash-point recovery, network fault tolerance, or exactly-once external side effects.

## Local verification

```text
TypeScript build: PASS
Test suite: 27/27 PASS
Failed: 0
Skipped: 0
```

## Not claimed as live-verified

- Arbitrary process/database crash-point characterization beyond the exercised transaction rollback scenario.
- Full recovery/reconciliation behavior after external PostgreSQL/network faults.
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
