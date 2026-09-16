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
- Current candidate head: `11cde873fd655774ae5d00e9cc57a8b6ef8d95e3`.
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
Latest CI run `211` checks out the exact candidate commit `11cde873fd655774ae5d00e9cc57a8b6ef8d95e3` rather than a pull-request merge ref. The complete verification job passed.

Verified gates:
1. Exact candidate checkout.
2. Strict TypeScript build and unit tests.
3. PostgreSQL schema bootstrap.
4. Four live PostgreSQL scenarios: concurrent append serialization, atomic rollback, projection checkpoint persistence, and owner-fenced outbox leasing/reclaim.
5. Explicit before-commit and after-commit/before-ack crash-window characterization.
6. Candidate source ZIP and npm TGZ build, verification, and upload.
7. Exact-candidate artifact provenance check in the workflow.

Hardening regressions are covered for delegated-authority lifetime, locale-independent canonicalization, application metadata binding in event digests, and PostgreSQL inherited-append/stream-head synchronization.

## Evidence State
- Current candidate head: `11cde873fd655774ae5d00e9cc57a8b6ef8d95e3`
- Latest verification run: GitHub Actions `211`
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
CI produced an unpublished candidate artifact from the exact branch head. It was downloaded and independently inspected outside the CI execution environment.

- Artifact ID: `10433161584`
- Artifact name: `sif-core-unpublished-candidate-11cde873fd655774ae5d00e9cc57a8b6ef8d95e3`
- GitHub wrapper SHA-256: `31aa341717629f6f78499a597a9c82b888caa198bc440642ff662a88412cbb54`
- Source ZIP SHA-256: `93541f32f05ecef97b93ee3dd492a8eb7f98c5e16306a80292705e57bd0fe648`
- npm TGZ SHA-256: `ac735987335e47aef3ca954c33c0459b2d9fd8f6eb393d8fb22f657598630d93`
- Package identity: `sif-core@0.5.0`

## Release / Promotion State
`0.6.0` is **not a released package**. No version bump, tag, registry publication, or merge to `main` has been performed.

The artifact/evidence gate is complete for the current candidate. Actual release promotion remains a separate explicit operation.

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
