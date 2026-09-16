# SIF Core 0.5.0

Dependency-free TypeScript kernel for a Sovereign Intelligence Fabric.

## Included in the package

- append-only event streams with optimistic concurrency
- deterministic replay and projections
- SHA-256 event integrity / stream hash chains
- filesystem content-addressed storage (CAS)
- evidence / provenance / semantic registries
- scoped, expiring authority and attenuating delegation
- default-deny policy admission with deny-overrides
- durable JSONL outbox
- transactional PostgreSQL event + outbox adapter
- PostgreSQL stream-head serialization and projection metadata
- Ed25519 attestations
- lineage / reconstruction verification
- capability-gated execution
- durable outbox leasing/reclaim and inbox idempotency primitives
- resumable projections
- Phase 3 Secure Federation boundaries
- Phase 4 Policy & Governance boundaries
- Phase 5 Evaluation & Observability boundaries

## Current candidate

The package identity remains `sif-core@0.5.0`. Phase 3, Phase 4, and Phase 5 are isolated unpublished implementation candidates; candidate verification does not imply a package version bump or registry publication.

Phase 4 provides immutable versioned policy bundles, explicit policy lifecycle, timestamp-aware historical resolution, deny-overrides/default-deny, a dependency-free provider-neutral policy adapter boundary, deterministic attributable decisions, resource limits, and a federation-to-local-policy sovereignty boundary.

Phase 5 provides bounded trace/evidence correlation, structured TRACE/METRIC/LOG observation records, deterministic evaluation records and replay descriptors, bounded fault injection with explicit observed-fault proof and distinct unavailable/evaluation-failed classifications, bounded parallel regression execution, and fail-closed promotion evidence checks.

F4-001..F4-040 are executable in `packages/sif-core/test/policy-governance.test.ts`.
F5-001..F5-060 are executable in `packages/sif-core/test/evaluation-observability-acceptance.test.ts`.

## Verification boundary

Exact-head SIF Core CI verifies checkout identity, strict build/tests, live PostgreSQL integration, crash-window characterization, candidate archive construction/verification, and artifact upload. A successful candidate run is evidence for that exact source checkout only.

Production OPA/Cedar deployment, production TLS/mTLS/SPIFFE deployment, production OpenTelemetry exporters, KMS/HSM integration, distributed consensus, production-scale HA/performance, exactly-once external side effects, automatic telemetry-based promotion, and registry publication remain outside this candidate boundary.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

The package version remains `0.5.0` until an explicit promotion/release decision.
