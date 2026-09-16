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

## 0.6 Live PostgreSQL Milestone

- Added dependency-free PostgreSQL wire-protocol integration harness.
- Added real PostgreSQL 16 service to GitHub Actions.
- Verified concurrent same-stream transactional serialization.
- Verified atomic rollback across event, stream head, and outbox on constraint failure.
- Verified durable projection checkpoint persistence and deterministic round-trip.
- Verified outbox lease exclusivity, expiry/reclaim, stale-owner fencing, and successful current-owner delivery.
- Added direct PostgreSQL crash-window characterization for before-commit and after-commit termination windows.
- Detected and fixed nondeterministic assumptions in the live outbox test; final verification uses one destination and deterministic sequencing.
- Detected and fixed SQL syntax in crash-window verification queries.
- Final candidate verification is tied to an exact checked-out commit and artifact manifest; pull-request merge refs are not used as candidate provenance.

### Final verification state

The implementation-level 0.6 persistence milestone is verified through the latest successful CI candidate line. The package version remains `0.5.0`; the 0.6 milestone is an integration-verification boundary, not a published package release.

### 0.7 Secure Federation — SPEC / CONTRACT START

- Defined `PHASE_3_FEDERATION_SPEC.md` as the normative Phase 3 boundary.
- Defined `PHASE_3_IMPLEMENTATION_CONTRACT.md` with component boundaries, typed failures, processing state machine, security/resource/provenance invariants, implementation order, and promotion gates.
- Defined `PHASE_3_TEST_MATRIX.md` with 60 required acceptance scenarios spanning identity, trust, signatures, capability negotiation, authority, inbox/idempotency, retry/recovery, reconciliation, resource abuse, time semantics, provenance, concurrency, fault injection, and artifact provenance.
- Created dedicated branch `feat/sif-core-0.7.0-secure-federation` from the exact verified Phase 2 candidate.
- Opened draft PR #3 against `feat/sif-core-0.6.0-live-postgres` to keep Phase 3 isolated from `main` and from the unpublished Phase 2 release boundary.
- No Phase 3 runtime implementation, package version bump, registry publication, or merge is claimed.

### Release Boundary

A future `0.6.0` artifact release requires fresh artifacts built from the promotion commit, SHA-256 identities, byte-preserving preservation, and independent verification. CI success does not imply merge or binary publication.

Phase 3 follows the same evidence-gated sequence:

`SPEC → CONTRACT → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
