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

The implementation-level 0.6 persistence milestone is verified through the successful CI candidate line. The package version remains `0.5.0`; the 0.6 milestone is an integration-verification boundary, not a published package release.

## 0.7 Secure Federation — SPEC / CONTRACT / IMPLEMENT / TEST / FIX / VERIFY

Phase 3 established canonical federation envelopes, integrity and typed failure boundaries, trust anchors and versioned trust bundles, durable federated inbox states, capability negotiation, sovereign local admission, deterministic reconciliation, bounded retry/recovery, transport identity binding, resource governance, and executable fault-injection/crash-window coverage. The final candidate was verified through exact checkout, strict build/tests, live PostgreSQL integration, federation/PostgreSQL crash-window characterization, archive verification, and candidate artifact upload.

## 0.8 Policy & Governance — SPEC / CONTRACT / IMPLEMENT / TEST / FIX / VERIFY

Phase 4 established immutable policy bundles/versions, explicit lifecycle, historical resolution, overlap fail-closed semantics, deny-overrides-allow, provider-neutral OPA/Cedar-shaped adapters, provider-result binding to policy identity, deterministic policy evidence, non-widening federated metadata, bounded evaluations, and an immutable in-memory evidence ledger. The final candidate was verified through exact-head CI including integration, crash-window, archive, and artifact checks.

## 0.9 Evaluation & Observability — SPEC / CONTRACT / IMPLEMENT / TEST / FIX / VERIFY

Phase 5 established dependency-free normalized trace/evidence correlation, structured TRACE/METRIC/LOG observations, deterministic evaluation records, candidate/environment-bound replay descriptors, a concrete bounded fault executor/injector boundary, true bounded regression parallelism, fail-closed promotion evidence, and executable F5-001..F5-060 coverage. Exact-head CI then passed strict build/tests, live PostgreSQL integration, both crash-window characterizations, candidate archive verification, and artifact upload on the Phase 5 candidate.

## 1.0 Knowledge / Semantic Plane — SPEC / CONTRACT / IMPLEMENT / TEST / FIX

Phase 6 implementation candidate introduces versioned ontology identity/lifecycle and temporal resolution, provider-neutral semantic compatibility, explicit epistemic states with attributable sources, a bounded acyclic provenance graph, semantic replay descriptors, deterministic semantic context hashing, and legacy knowledge handoff that preserves source identity while surfacing unmapped records. Executable F6-001..F6-060 coverage is committed; exact-head verification is the next gate.

## Current Verification Boundary

The current candidate identity is the branch HEAD. The authoritative verification record is the successful exact-head SIF Core CI run for that same commit, together with its uploaded unpublished candidate artifact and digest. Dynamic run/artifact identifiers are not committed to this mutable log because recording them would create a self-referential commit loop.

No package version bump, registry publication, merge to `main`, production deployment claim, or automatic promotion is implied by an implementation candidate.
