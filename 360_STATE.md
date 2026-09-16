# SIF 360° State

## Identity
- Repository: `ahmedsaturki/sif`
- Product: Sovereign Intelligence Fabric
- Current verified kernel baseline: `SIF Core 0.5.0`
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
- self-model verification
- reconstruction verification

## Core Laws

- exit status alone never proves success.
- configured, available, usable, verified and production-safe are different states.
- events are authoritative history; projections are derived state.
- historical events are never silently mutated.
- trust never grants authority.
- delegation cannot increase authority.
- remote authority never becomes local authority automatically.
- memory is not policy.
- knowledge is not truth.
- evidence requires provenance, scope and freshness.
- retry requires idempotency.
- recovery requires reconciliation.
- self-reported verification is not independent verification.
- simulation is not reality.
- counterfactuals are not history.
- latest is not necessarily authoritative.
- external side effects are not exactly-once merely because an outbox is durable.

## Conceptual Intelligence Layers

SIF research has established design layers for systemic, ecological, institutional, federated, long-horizon, reflexive, continuity, knowledge/legacy and semantic intelligence. These are architecture research targets, not all-current runtime features.

## Current Unknowns / Boundaries

1. A live PostgreSQL instance is required for wire-level concurrency validation.
2. Real federation requires authenticated transport and trust-domain verification.
3. Policy adapters must be tested against the selected policy engine.
4. Key custody requires KMS/HSM or an explicitly bounded deployment strategy.
5. Distributed consensus is not provided by the current kernel.
6. Production telemetry requires an OpenTelemetry implementation and privacy policy.
7. External effects need consumer-side idempotency or a shared transaction for stronger guarantees.

## Next Engineering Gates

Gate A — repository completeness: every tested source/test file must be present in Git.

Gate B — CI: build and tests run from the committed tree.

Gate C — live PostgreSQL: migrations, concurrency, crash/restart, leases, reclaim and idempotency.

Gate D — transport/security: authenticated federation boundary.

Gate E — evaluation: replay, fault injection, regression and evidence reports.

## Preservation

The complete local 0.5.0 source tree and npm artifact are preserved in the working artifact set. The repository stores inventories and verification boundaries; binary artifacts should be attached to a release or artifact store when release infrastructure is intentionally established.
