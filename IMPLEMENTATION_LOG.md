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

- Defined the Phase 5 evaluation/observability specification, implementation contract, and executable F5-001..F5-060 matrix.
- Implemented dependency-free normalized trace/evidence correlation with bounded baggage and deterministic context identity.
- Implemented structured TRACE/METRIC/LOG observation records with deterministic IDs, bounded attributes/payloads, immutable in-memory reads, and observation-backend failure isolation.
- Implemented deterministic evaluation records with candidate/environment provenance, normalized input hashing, explicit input and record byte limits, and immutable evidence references.
- Implemented replay descriptors bound to candidate, artifact, environment, suite/case, input digest, and expected-result digest with fail-closed mismatch detection.
- Replaced interface-only fault modeling with a bounded concrete fault injector/executor boundary. Observed faults require explicit non-empty evidence; no-fault, evaluator failure, and unavailable outcomes remain distinct.
- Upgraded regression execution to true bounded parallelism using `maxConcurrentEvaluations`, while preserving deterministic result ordering and candidate propagation.
- Hardened promotion evidence checks so requested faults cannot pass without an observed status and evidence reference.
- Fixed acceptance-harness defects uncovered by exact-head CI, including nested candidate override coverage and strict `exactOptionalPropertyTypes` handling.
- Added explicit measured-vs-expected regression semantics while preserving successful execution-only `undefined` runners as measurable execution success.
- Reconciled the acceptance matrix descriptions with the executable test groups instead of marking documentary code paths as proof.
- Exact-head CI subsequently passed the full committed tree, live PostgreSQL integration, both crash-window characterizations, candidate archive build/verification, and candidate artifact upload on the resulting Phase 5 candidate.

## 1.0 Knowledge / Semantic Plane — SPEC / CONTRACT / IMPLEMENT / TEST / FIX / VERIFY

- Reused the existing evidence, knowledge, semantic, and authority primitives as the foundation for a higher-level versioned semantic plane.
- Implemented immutable ontology versions with deterministic identity, explicit `DRAFT → ACTIVE → RETIRED` lifecycle, bounded concepts/mappings, and caller-immutable reads.
- Implemented deterministic semantic compatibility decisions with explicit version-bound mappings and fail-closed missing, ambiguous, low-confidence, approximate, and conditional cases.
- Implemented evidence-qualified epistemic knowledge with temporal validity, source attribution, contradiction detection, and history-preserving supersession/retraction.
- Implemented immutable provenance nodes with parent validation, cycle rejection, bounded ancestry traversal, and graph identity.
- Implemented append-only semantic operations and deterministic replay snapshots bound to exact ontology/version filters.
- Implemented explicit legacy handoff preserving source identity, evidence/provenance, semantic version, and `authorityWidened: false`.
- Added executable F6-001..F6-060 acceptance coverage.
- The Phase 6 candidate is verified only through exact-head CI against the current branch head; dynamic run/artifact identifiers remain outside mutable state docs.

## Current Verification Boundary

The current candidate identity is the branch HEAD. The authoritative verification record is the successful exact-head SIF Core CI run for that same commit, together with its uploaded unpublished candidate artifact and digest. Dynamic run/artifact identifiers are intentionally not committed here.

No package version bump, registry publication, merge to `main`, production semantic-graph deployment, automatic truth determination, or authority promotion is implied.

## Release Discipline
`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
