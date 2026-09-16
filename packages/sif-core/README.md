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

## Current candidate

The package identity remains `sif-core@0.5.0`. Phase 3 and Phase 4 are isolated unpublished implementation candidates; candidate verification does not imply a package version bump or registry publication.

Phase 4 provides immutable versioned policy bundles, explicit policy lifecycle, timestamp-aware historical resolution, deny-overrides/default-deny, a dependency-free provider-neutral policy adapter boundary, deterministic attributable decisions, resource limits, and a federation-to-local-policy sovereignty boundary.

F4-001..F4-040 are executable in `packages/sif-core/test/policy-governance.test.ts`.

## Verification boundary

Exact-head SIF Core CI verifies checkout identity, strict build/tests, live PostgreSQL integration, crash-window characterization, candidate archive construction/verification, and artifact upload. A successful candidate run is evidence for that exact source checkout only.

Production OPA/Cedar deployment, production TLS/mTLS/SPIFFE deployment, KMS/HSM integration, distributed consensus, production-scale HA/performance, exactly-once external side effects, and registry publication remain outside this candidate boundary.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

The package version remains `0.5.0` until an explicit promotion/release decision.
