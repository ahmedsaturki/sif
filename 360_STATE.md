# SIF 360° State

## Identity
- Repository: `ahmedsaturki/sif`
- Product: Sovereign Intelligence Fabric
- Current package baseline: `SIF Core 0.5.0`
- Current integration verification milestone: `0.6 Live PostgreSQL`
- Implementation language: TypeScript
- Core dependency policy: dependency-free kernel
- Primary persistence target: PostgreSQL

## Verified Kernel

Implemented and tested:
- append-only events
- optimistic concurrency
- per-stream hash chains
- deterministic replay
- resumable projections
- SHA-256 event integrity
- filesystem CAS
- evidence/provenance/knowledge/semantic/lineage registries
- scoped and expiring authority
- attenuating delegation
- default-deny policy with deny-overrides
- durable outbox and leases
- durable inbox/idempotency
- PostgreSQL transactional event/outbox contracts
- explicit per-stream row serialization
- Ed25519 attestations
- capability-gated execution
- self-model/reconstruction verification

## Live PostgreSQL 0.6 Verification

GitHub Actions run 64 verified the committed PostgreSQL integration against a real PostgreSQL 16 service. The actual `PostgresTransactionalEventStore` was exercised from independent database connections and the test confirmed that concurrent writers using the same expected stream version are serialized at the `sif_stream_heads` row lock, leaving one version-1 event and one durable outbox row.

## Evidence State

- Local TypeScript build: PASS
- Local tests: 27/27 PASS
- GitHub Actions artifact identity: PASS
- GitHub Actions committed build/test: PASS
- GitHub Actions live PostgreSQL integration: PASS

## Explicit Unknown / Not Claimed

- TLS/mTLS/SPIFFE federation transport
- OPA/Cedar adapter
- KMS/HSM secret integration
- distributed consensus
- production OpenTelemetry exporter
- exactly-once external side effects
- production-scale PostgreSQL performance/HA characterization

## Release / Promotion State

`feat/sif-core-0.5.0` remains the verified kernel baseline.
`feat/sif-core-0.6.0-live-postgres` contains the live persistence verification milestone.
Binary package versioning remains 0.5.0 until a new 0.6.0 release artifact is built, hashed, preserved, and independently verified.

## Governing Laws

- configured != live != usable != production-safe
- exit code != semantic success
- event history is authoritative
- snapshots/projections are derived
- no promotion without reproducible evidence
- no authority without explicit scope
- retry requires idempotency
- recovery requires reconciliation
- remote evidence does not become local authority automatically
- conceptual research is not implementation evidence

## Release Discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
