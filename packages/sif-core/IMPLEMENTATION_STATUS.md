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

GitHub Actions run 93 executed the committed implementation against a real PostgreSQL 16 service and passed every persistence gate in the workflow.

Verified live scenarios:

1. **Concurrent same-stream append** — two independent PostgreSQL connections contend for version 1; the `sif_stream_heads ... FOR UPDATE` serialization point accepts exactly one writer, leaving one event and one durable outbox row.
2. **Atomic rollback** — a constraint failure during a transactional append leaves event, stream-head update, and outbox state rolled back together.
3. **Projection checkpoint durability** — a checkpoint persists and round-trips deterministically through PostgreSQL.
4. **Outbox lease lifecycle** — one worker owns the item, another worker is blocked while the lease is valid, the item is reclaimed after expiry, stale-owner delivery is fenced, and the new owner can mark it delivered.
5. **Crash-window characterization** — terminating a PostgreSQL backend before commit leaves no partial stream/event/outbox state and permits retry; terminating the backend after commit but before acknowledgement preserves the committed event and stream head, with no outbox item in the direct SQL scenario.

## CI evidence

```text
Implementation verification baseline: GitHub Actions run 93
PostgreSQL service: 16
Artifact identity: PASS
Strict committed build + tests: PASS
Unit tests: 27/27 PASS
Schema bootstrap: PASS
Live PostgreSQL integration: 4/4 PASS
Crash-window characterization: PASS
```

Run 93 verified the implementation commit before the final documentation-only evidence commits. A fresh CI run on the final branch HEAD is required before promotion or artifact publication.

## Explicit boundaries / not claimed

- arbitrary process/database crash-point coverage
- full recovery/reconciliation after external database or network faults
- network-partition recovery
- production-scale PostgreSQL throughput/latency characterization
- HA/failover characterization
- exactly-once external side effects
- TLS/mTLS/SPIFFE federation transport
- OPA/Cedar adapters
- KMS/HSM integration
- distributed consensus
- production OpenTelemetry export

The durable delivery model remains at-least-once. Exactly-once external effects require transactional participation by the side effect or independently idempotent consumers.

Package version remains `0.5.0` until a dedicated `0.6.0` artifact set is built, SHA-256 hashed, preserved, and independently verified.
