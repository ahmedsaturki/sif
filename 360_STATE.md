# SIF 360° State

## Identity
- Repository: `ahmedsaturki/sif`
- Product: Sovereign Intelligence Fabric
- Current package baseline: `SIF Core 0.5.0`
- Current integration verification milestone: `0.6 Live PostgreSQL`
- Implementation language: TypeScript
- Core dependency policy: dependency-free kernel
- Primary persistence target: PostgreSQL

## Repository State
- `main` remains at Genesis `f4408d81375786e7a9f0715cf70609d0e257a67c`.
- `feat/sif-core-0.5.0` remains the preserved kernel baseline.
- `feat/sif-core-0.6.0-live-postgres` is the live-persistence candidate line.
- The branch is maintained as an evidence-gated candidate line; the latest successful CI run is the authoritative verification record for its exact HEAD.
- PR #2 remains open and unmerged.

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
The latest successful CI run checks out the exact candidate commit rather than a pull-request merge ref. It verifies exact checkout identity, strict TypeScript build/tests, PostgreSQL schema bootstrap, four live PostgreSQL scenarios, explicit crash-window characterization, candidate archive build/verification, and artifact upload.

The live scenarios cover concurrent append serialization, atomic rollback of event/head/outbox, durable projection checkpoints, and owner-fenced outbox lease lifecycle.

## Evidence State
- Exact candidate checkout: PASS
- Strict TypeScript build + tests: PASS
- Unit tests: 31/31 PASS
- PostgreSQL schema bootstrap: PASS
- Live PostgreSQL integration: 4/4 PASS
- Crash-window characterization: PASS
- Candidate archive build: PASS
- Candidate archive verification: PASS
- Candidate artifact upload: PASS

## Artifact State
The candidate artifact is produced from the exact checked-out candidate commit. It is independently downloaded and inspected outside the CI execution environment. The artifact/evidence record is maintained in `RELEASE_EVIDENCE_0.6.0.md` and the preserved local/Library evidence bundle.

## Release / Promotion State
`0.6.0` is **not a released package**. No version bump, tag, registry publication, or merge to `main` has been performed.

The artifact/evidence gate is complete for the verified candidate line. Actual release promotion remains a separate explicit operation.

## Explicit Unknown / Not Claimed
- arbitrary process/database crash-point coverage
- full recovery/reconciliation after external database/network faults
- network-partition recovery
- production-scale PostgreSQL performance/HA characterization
- TLS/mTLS/SPIFFE federation transport
- OPA/Cedar adapter
- KMS/HSM secret integration
- distributed consensus
- production OpenTelemetry exporter
- exactly-once external side effects

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
- artifact provenance must identify the exact candidate content being promoted

## Release Discipline
`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
