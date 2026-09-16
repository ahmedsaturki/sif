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

### 0.7 Secure Federation — SPEC / CONTRACT / IMPLEMENT

- Defined `PHASE_3_FEDERATION_SPEC.md` as the normative Phase 3 boundary.
- Defined `PHASE_3_IMPLEMENTATION_CONTRACT.md` with component boundaries, typed failures, processing state machine, security/resource/provenance invariants, implementation order, and promotion gates.
- Defined `PHASE_3_TEST_MATRIX.md` with 60 required acceptance scenarios spanning identity, trust, signatures, capability negotiation, authority, inbox/idempotency, retry/recovery, reconciliation, resource abuse, time semantics, provenance, concurrency, fault injection, and artifact provenance.
- Created dedicated branch `feat/sif-core-0.7.0-secure-federation` from the exact verified Phase 2 candidate.
- Opened draft PR #3 against `feat/sif-core-0.6.0-live-postgres` to keep Phase 3 isolated from `main` and from the unpublished Phase 2 release boundary.
- Implemented canonical federation envelope domain types, typed failure taxonomy, deterministic payload/envelope canonicalization, payload SHA-256 integrity digest, provider-neutral signing/verifier interfaces, fail-closed protocol/signature-algorithm validation, MESSAGE IDENTITY vs EVENT IDENTITY separation, and deterministic capability ordering.
- Added trust-anchor/trusted-peer validation with effective-time, revocation, transport binding, and versioned trust-bundle activation/retirement.
- Added durable federated inbox state progression `DELIVERED → PROCESSED → COMMITTED → VERIFIED`, replay/idempotency protection, PostgreSQL transaction boundary, and crash-window characterization.
- Added session-scoped capability negotiation with semantic matching and negotiated message/attachment limits.
- Added sovereign local admission through the existing `PolicyEngine`; remote trust does not become local authority.
- Added bounded deterministic reconciliation with duplicate, cursor, divergence, explicit conflict, and batch-limit handling.
- Added bounded delivery retry semantics with explicit `RETRY`, `STOP`, and `RECONCILE` classification, including `UNKNOWN_OUTCOME` handling.
- Added provider-neutral transport session/send/close boundary with explicit local-domain binding, peer identity binding, negotiated-scope enforcement, and result identity validation.
- Added transport-level binding between the canonical negotiated peer scope (`domain/subject`) and the authenticated session peer identity; mismatched scopes now fail closed before provider open/send.
- Added explicit transport regression coverage for canonical negotiated peer identity binding and updated the fault-injection harness fixtures to use the same canonical scope.
- Added resource/abuse governance for concurrent sessions, inbox work, replay retention, reconciliation batch size, and per-peer/global session rate limits.
- Added executable coverage for delayed/replayed observations, provenance attribution, cross-peer identity collision, historical replay semantics, remote-authority isolation, deterministic reconciliation, and retry/reconnect backpressure.
- Added executable fault-injection coverage for forced authentication failure, signature tamper, duplicate delivery, peer outage/recovery, and post-send connection loss producing `UNKNOWN_OUTCOME` followed by reconciliation.
- Fixed the federated inbox crash-window harness so a PostgreSQL socket `close` during an induced backend termination rejects the active request instead of leaving the test pending.
- Added declared retention-window enforcement in the federated inbox; delivery at/after `expiresAt` is rejected with typed `REPLAY_DETECTED`.
- Added explicit encrypted-transport metadata coverage to prove encryption state does not substitute for peer authentication/trust at the provider-neutral transport boundary.
- Added explicit strict TypeScript fixtures for the fault-injection and inbox acceptance tests so the final committed test tree builds cleanly under `exactOptionalPropertyTypes`.
- Updated GitHub Actions to current Node 24-compatible major versions for checkout, Node setup, and artifact upload; this maintenance change was validated by the exact-head CI run after the update.
- Aligned the typed federation failure contract with the implementation: the public codes are `AUTHENTICATION_FAILURE` and `INTEGRITY_FAILURE`; local policy denial is represented as `AUTHORIZATION_DENIED` with the underlying local rule/reason retained as attribution.

## Current Verification Boundary

The current Secure Federation candidate and its exact verification provenance are intentionally tracked outside this mutable log entry to avoid a self-referential commit loop. The authoritative current candidate is the branch HEAD recorded in PR #3, and its exact-head CI run/artifact must always be used as the provenance source.

The latest successful exact-head CI execution also covers:
- exact candidate checkout verification;
- the complete committed test tree;
- live PostgreSQL integration;
- federated inbox crash-window characterization;
- PostgreSQL crash-window characterization;
- unpublished candidate archive build, extraction and SHA-256 verification;
- candidate artifact upload.

The current committed test execution contains explicit scenarios for F3-031, F3-033, F3-036, F3-043, F3-044, F3-046, F3-047, F3-048, F3-049, F3-051, F3-052, F3-053..057, plus the existing federation, resource, retry, transport, trust, inbox, reconciliation, concurrency, and PostgreSQL integration coverage.

`PHASE_3_EVIDENCE_LEDGER.md` maps all F3-001..F3-060 Required rows to executable tests or explicit boundary evidence.

F3-050 remains deliberately bounded to the provider-neutral kernel: the executable test proves that encrypted transport metadata does not authenticate or establish trust for an unauthenticated peer. It does not claim a production TLS/mTLS/SPIFFE deployment.

No package version bump, registry publication, merge to `main`, production-federation claim, or release/promotion is implied by this verification boundary.

Phase 3 follows:

`SPEC → CONTRACT → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
