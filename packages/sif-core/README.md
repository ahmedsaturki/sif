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
- durable JSONL outbox and inbox idempotency primitives
- transactional PostgreSQL event + outbox adapter
- PostgreSQL stream-head serialization and projection metadata
- Ed25519 attestations and capability-gated execution
- lineage / reconstruction verification
- Secure Federation, Policy & Governance, and Evaluation & Observability boundaries
- Knowledge / Semantic Plane: immutable ontology versions, semantic compatibility, epistemic knowledge, provenance graph, semantic replay, and legacy handoff

## Current candidate

The package identity remains `sif-core@0.5.0`. Later phases are isolated unpublished implementation candidates; candidate verification does not imply a package version bump or registry publication.

## Phase 6 boundary

Phase 6 adds versioned ontology lifecycle, deterministic compatibility decisions, evidence-qualified time-aware knowledge, immutable provenance, bounded semantic replay, and explicit legacy handoff. Knowledge and semantic evidence do not grant or widen authority, and ambiguous compatibility fails closed.

F6-001..F6-060 are executable in `packages/sif-core/test/knowledge-semantic-acceptance.test.ts`.

## Verification boundary

Exact-head SIF Core CI verifies checkout identity, strict build/tests, live PostgreSQL integration, crash-window characterization, candidate archive construction/verification, and artifact upload. A successful candidate run is evidence for that exact source checkout only.

Production distributed knowledge graphs, external ontology registries, semantic consensus, automatic truth determination, KMS/HSM integration, distributed consensus, exactly-once external side effects, automatic authority promotion, and registry publication remain outside this candidate boundary.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

The package version remains `0.5.0` until an explicit promotion/release decision.
