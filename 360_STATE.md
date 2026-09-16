# SIF 360° State

## Identity
- Repository: `ahmedsaturki/sif`
- Product: Sovereign Intelligence Fabric
- Current package baseline: `SIF Core 0.5.0`
- Verified integration foundation: Phase 2 Live PostgreSQL
- Current implementation candidate: Phase 5 Evaluation & Observability
- Implementation language: TypeScript
- Core dependency policy: dependency-free kernel
- Primary persistence target: PostgreSQL

## Repository State
- `main` remains at the preserved Genesis line and has not been merged with later candidate phases.
- `feat/sif-core-0.5.0` remains the preserved kernel baseline.
- `feat/sif-core-0.6.0-live-postgres` remains the preserved Phase 2/live-persistence candidate line.
- `feat/sif-core-0.7.0-secure-federation` remains the preserved Phase 3 candidate line.
- `feat/sif-core-0.8.0-policy-governance` remains the preserved Phase 4 candidate line.
- `feat/sif-core-0.9.0-evaluation-observability` is the current Phase 5 candidate line.
- PR #5 is open, draft, unmerged, and targets the verified Phase 4 candidate line.
- The current candidate identity is always the branch HEAD; exact-head CI and its uploaded artifact are the authoritative verification/provenance records.

## Preserved Foundation
The SIF Core foundation includes append-only events, optimistic concurrency, per-stream hash chains, deterministic replay, resumable projections, SHA-256 integrity, filesystem CAS, evidence/provenance/knowledge/semantic/lineage registries, scoped authority, delegation attenuation, default-deny policy, durable outbox/inbox, PostgreSQL transactional contracts, Ed25519 attestations, capability-gated execution, self-model/reconstruction verification, secure federation, policy governance, and evaluation/observability boundaries described below.

## Phase 3 Secure Federation
Implemented and verified Phase 3 capabilities include canonical federation envelopes and integrity, provider-neutral signing/trust boundaries, message/event identity separation, versioned trust bundles, durable federated inbox state, negotiated capability and peer scope, sovereign local admission, bounded reconciliation/retry/recovery, transport identity binding, resource governance, explicit fault injection, and crash-window verification.

## Phase 4 Policy & Governance
Implemented and verified Phase 4 capabilities include immutable policy bundles and versions, explicit lifecycle, historical resolution, overlap fail-closed behavior, deny-overrides-allow, provider-neutral OPA/Cedar-shaped integration boundaries, provider-result identity binding, deterministic policy evidence, local/federated non-widening semantics, bounded evaluation resources, and immutable in-memory evidence ledger behavior.

## Phase 5 Evaluation & Observability
Implemented capabilities include:
- bounded and deterministic trace/evidence correlation;
- dependency-free structured TRACE/METRIC/LOG observation adapters;
- immutable observation sink reads and safe isolation from business semantics;
- deterministic evaluation records with candidate/environment identity and explicit input/record byte limits;
- candidate/artifact/environment-bound replay descriptors with fail-closed mismatch detection;
- bounded fault execution with explicit observed-fault evidence, `NOT_OBSERVED`, `EVALUATION_FAILED`, and `UNAVAILABLE` classifications;
- bounded regression execution with true parallelism constrained by `maxConcurrentEvaluations`;
- fail-closed promotion evidence checks for candidate identity and required fault proof;
- executable acceptance coverage F5-001..F5-060.

## Phase 5 Evidence State
- Exact candidate checkout: PASS in the authoritative exact-head CI verification.
- Strict committed TypeScript build/tests: PASS.
- Live PostgreSQL integration: PASS.
- Federated inbox crash-window characterization: PASS.
- PostgreSQL crash-window characterization: PASS.
- Candidate archive build: PASS.
- Candidate archive verification: PASS.
- Candidate artifact upload: PASS.
- Phase 5 runtime and test coverage were subsequently hardened with explicit fault proof, record-size bounds, true bounded concurrency, and aligned acceptance documentation; the current branch HEAD must always be re-verified after any additional commit.
- Dynamic CI run numbers, run IDs, artifact IDs, and artifact digests are intentionally not committed here because they would create a self-referential provenance loop.

## Verification / Artifact Provenance
- The authoritative verification record is the successful SIF Core CI workflow run whose `head_sha` exactly equals the current branch HEAD.
- That run's uploaded unpublished candidate artifact and digest are authoritative for that exact commit.
- CI independently verifies checkout identity, the committed test tree, live PostgreSQL behavior, crash windows, candidate archives, archive hashes, and artifact upload.
- PR metadata may summarize the latest verification, but it is not the canonical candidate identity.

## Release / Promotion State
- `sif-core` package remains `0.5.0`.
- No version bump has been performed.
- No registry publication or release tag has been performed.
- No merge to `main` has been performed.
- No production OpenTelemetry deployment claim has been made.
- Phase 5 PR #5 remains a draft candidate pending explicit promotion/release handling.

## Explicit Unknown / Not Claimed
- production OpenTelemetry exporters and telemetry SLA
- deployment-specific TLS/mTLS/SPIFFE configuration
- arbitrary distributed/network fault recovery beyond characterized scenarios
- production-scale federation HA/performance
- KMS/HSM integration
- distributed consensus
- exactly-once external side effects
- automatic promotion from telemetry or evaluation scores alone

## Governing Laws
- configured != live != usable != production-safe
- exit code != semantic success
- event history is authoritative
- snapshots/projections are derived
- no promotion without reproducible evidence
- no authority without explicit scope
- remote evidence does not become local authority automatically
- telemetry does not become authority
- fault success requires explicit observed-fault proof
- concurrency/resource limits must be executable, not documentary only
- conceptual research is not implementation evidence
- artifact provenance must identify the exact candidate content being promoted

## Release Discipline
`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
