# SIF Implementation Log

## Baseline Sequence

| Stage | Main addition | Verification |
|---|---|---|
| 0.0.0 | Empty repository / architecture genesis | repository state inspected |
| 0.1.0 | Core contracts, event store, replay, registries, authority, execution gates | build + tests |
| 0.2.0 | Integrity, CAS, attestations, policy, durable outbox | integration tests |
| 0.3.0 | PostgreSQL transactional adapter | typed transaction contract tests |
| 0.4.0 | Stream-head serialization, checkpoints, leases, inbox/idempotency | expanded integration tests |
| 0.5.0 | Workers, durable processing and restart-safe primitives | 27/27 tests PASS |

## Critical Fixes

### Stream Concurrency
A design based only on `MAX(stream_version)` was insufficient as a serialization primitive. The PostgreSQL schema therefore uses a dedicated `sif_stream_heads` row and `FOR UPDATE` locking for per-stream append serialization.

### Policy Semantics
Deny rules override matching allow rules. Policy defaults to deny when no explicit allow applies.

### Outbox Semantics
Durable delivery is at-least-once. Exactly-once external effects are intentionally not claimed.

### Worker Leasing
Leases have owners, expirations and reclaim behavior. A stale worker cannot complete work after its lease is lost.

### Inbox Idempotency
Consumer-side event identity is persisted so duplicate delivery does not imply duplicate committed handling.

## Evidence Discipline

The project records what was actually run and separates local unit/integration contract verification, live infrastructure verification, and future integration requirements.

Unknown infrastructure is never represented as verified implementation.
