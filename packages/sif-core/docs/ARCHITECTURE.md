# SIF Core Architecture

SIF Core is a dependency-free TypeScript kernel. It keeps the authoritative domain contracts small and pushes environment-specific integrations behind typed adapters.

## Authoritative path

Event history is the durable source for reconstructed state. Projections, indexes and caches are derived. Event envelopes carry identity, stream version, causal/correlation links, time fields and payload metadata.

## Integrity

Hash chaining binds each event to the previous digest in the same stream. Ed25519 attestations can independently bind signed claims to artifact/content digests. CAS addresses immutable content by SHA-256 digest.

## Authority and policy

Authority is scoped and optionally expiring. Delegation is attenuating: delegated capabilities and lifetime cannot exceed the parent grant. Policy defaults to deny and explicit deny rules override allow matches.

## Delivery

Outbox records are idempotent per `(event_id, destination)`. The durable JSONL implementation survives restart. The PostgreSQL transactional implementation writes the domain event and its outbox rows within one database transaction.

## PostgreSQL adapter

`PostgresEventStore` expects an injected client exposing `query()`. It has no `pg` package dependency, preserving the core's dependency-free property. `PostgresTransactionalEventStore.appendAndEnqueue()` uses `BEGIN`, row locking on `sif_stream_heads`, event insertion, idempotent outbox insertion, and `COMMIT`; failures execute `ROLLBACK`.

The PostgreSQL schema lives in `sql/postgres-schema.sql`.

## Live verification

GitHub Actions run 169 exercises the committed candidate `3f1a248b226122696dd612cd7740e3c851c9a31f` against a real PostgreSQL 16.15 service. The live harness uses two independent database connections for same-stream contention and directly verifies transaction, checkpoint, outbox lease, reclaim, owner-fencing, and crash-window behavior.

Verified scenarios are documented in `RELEASE_EVIDENCE_0.6.0.md` and `VERIFICATION_MATRIX.md`. This is implementation-level integration evidence, not a claim of arbitrary production failure coverage.

## Durable delivery

The PostgreSQL path uses a transactional outbox. A worker claims pending rows using `FOR UPDATE SKIP LOCKED`, records a lease owner and expiry, and only the lease owner may complete the row. Expired leases are reclaimable. This gives crash-recoverable at-least-once delivery. It does not provide exactly-once effects for external systems; handlers must be idempotent or share a transaction with inbox/outbox state.

## Resumable projections

Projection checkpoints are derived state. A runner reads the checkpoint, replays the authoritative event stream needed to reconstruct the projection, applies only new events, verifies contiguous versions, computes a deterministic state digest, and persists the new checkpoint.

## Remaining boundaries

Arbitrary crash-point coverage, full external database/network recovery and reconciliation, production-scale PostgreSQL performance/HA, network partitions, SPIFFE/mTLS, OPA/Cedar, KMS/HSM, distributed consensus, production OpenTelemetry export, and exactly-once external side effects remain outside the verified milestone.
