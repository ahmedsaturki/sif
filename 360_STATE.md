# SIF 360° State

## Identity
- Repository: `ahmedsaturki/sif`
- Product: Sovereign Intelligence Fabric
- Current package baseline: `SIF Core 0.5.0`
- Current verified integration milestone: `0.6 Live PostgreSQL`
- Current implementation candidate: `Phase 3 Secure Federation`
- Implementation language: TypeScript
- Core dependency policy: dependency-free kernel
- Primary persistence target: PostgreSQL

## Repository State
- `main` remains at Genesis `f4408d81375786e7a9f0715cf70609d0e257a67c`.
- `feat/sif-core-0.5.0` remains the preserved kernel baseline.
- `feat/sif-core-0.6.0-live-postgres` remains the preserved Phase 2/live-persistence candidate line at `0ede9babeba1303c44ea592812a48bcd874db1e4`.
- `feat/sif-core-0.7.0-secure-federation` is the current Phase 3 candidate line.
- The current candidate identity is the branch HEAD; exact verification is recorded by the CI run and artifact for that same commit.
- PR #3 is open, draft, unmerged, and mergeable; it targets `feat/sif-core-0.6.0-live-postgres`.
- The candidate line is evidence-gated; the latest successful exact-head CI run is the authoritative verification record for the current candidate.

## Verified Kernel / Phase 2 Foundation
The preserved SIF Core foundation includes:
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

## Phase 2 Live PostgreSQL Verification
The preserved Phase 2 candidate line was verified through exact checkout, strict TypeScript build/tests, PostgreSQL schema bootstrap, live PostgreSQL integration, crash-window characterization, candidate archive build/verification, and artifact upload.

The live PostgreSQL scenarios covered concurrent append serialization, atomic rollback of event/head/outbox, durable projection checkpoints, and owner-fenced outbox lease lifecycle.

## Phase 3 Secure Federation
Implemented slices on the current candidate include:
- federation specification, implementation contract, test matrix, and evidence ledger
- canonical federation envelope and deterministic canonicalization
- payload SHA-256 integrity and typed federation failure taxonomy
- provider-neutral signing/verifier boundary and fail-closed algorithm validation
- MESSAGE IDENTITY versus EVENT IDENTITY separation
- trust anchors, trusted-peer validation, effective-time/revocation checks, and versioned trust bundles
- durable federated inbox with `DELIVERED → PROCESSED → COMMITTED → VERIFIED` semantics
- declared retention-window enforcement for delayed delivery/replay
- session-scoped capability negotiation with semantic compatibility checks and negotiated size limits
- sovereign local admission through the existing `PolicyEngine`
- bounded reconciliation with duplicate, cursor, divergence, and conflict handling
- bounded retry with explicit `RETRY`, `STOP`, and `RECONCILE` outcomes
- provider-neutral transport session/send/close with explicit local-domain and peer binding
- negotiated peer scope bound to canonical authenticated transport identity
- explicit separation of transport encryption metadata from authentication/trust
- resource/abuse governance for sessions, inbox work, replay retention, rates, and reconciliation batches
- executable fault-injection coverage for authentication failure, signature tamper, duplicate delivery, peer outage/recovery, and post-send `UNKNOWN_OUTCOME` reconciliation
- explicit acceptance coverage for identity omission, sender rebinding, retry-storm bounds, reordered inbox delivery, historical replay, cross-peer identity collision, and deterministic reconciliation

## Phase 3 Evidence State
- Required acceptance rows: `F3-001..F3-060`
- Exact candidate checkout: PASS when verified by the authoritative exact-head CI run.
- Strict committed TypeScript build/tests: PASS in the latest successful exact-head CI run.
- Live PostgreSQL integration: PASS in the latest successful exact-head CI run.
- Federated inbox crash-window characterization: PASS in the latest successful exact-head CI run.
- PostgreSQL crash-window characterization: PASS, including before-commit rollback and after-commit persistence.
- Candidate archive build: PASS in the latest successful exact-head CI run.
- Candidate archive verification: PASS in the latest successful exact-head CI run.
- Candidate artifact upload: PASS in the latest successful exact-head CI run.
- Failure taxonomy is aligned between contract and public implementation.
- F3-050 remains provider-neutral: encrypted transport metadata does not establish trust by itself.
- Dynamic run number, run ID, artifact ID, and artifact digest are intentionally not committed here because changing them would change the candidate HEAD and immediately stale the recorded values.

## Verification / Artifact Provenance
- The authoritative verification record is the successful SIF Core CI workflow run whose `head_sha` exactly equals the current branch HEAD.
- That run's uploaded candidate artifact and digest are the authoritative artifact provenance for that exact commit.
- The CI workflow independently checks exact checkout identity, runs build/tests and PostgreSQL/crash-window characterization, builds the unpublished candidate archives, verifies their contents and hashes, and uploads the resulting artifact.
- PR metadata may summarize the latest verified run, but it is not the canonical source of candidate identity; the branch HEAD plus exact-head CI record are.

## Release / Promotion State
- `sif-core` package remains `0.5.0`.
- No version bump has been performed.
- No tag or registry publication has been performed.
- No merge to `main` has been performed.
- No production-federation claim has been made.
- PR #3 remains a draft pending a separate explicit promotion/release decision.

## Explicit Unknown / Not Claimed
- deployment-specific TLS/mTLS/SPIFFE configuration
- arbitrary distributed/network fault recovery beyond characterized scenarios
- production-scale federation HA/performance
- OPA/Cedar adapters
- KMS/HSM integration
- distributed consensus
- production OpenTelemetry exporters
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
