# SIF 360° State

## Identity
- Repository: `ahmedsaturki/sif`
- Product: Sovereign Intelligence Fabric
- Current package baseline: `SIF Core 0.5.0`
- Current implementation candidate: Phase 6 — Knowledge / Semantic Plane
- Implementation language: TypeScript
- Core dependency policy: dependency-free kernel
- Primary persistence target: PostgreSQL

## Repository State
- `main` remains at the preserved Genesis line and is not merged with later candidate phases.
- Phases 2–5 remain preserved on their dedicated candidate lines.
- `feat/sif-core-1.0.0-knowledge-semantic` is the current Phase 6 candidate line.
- PR #6 is open, draft, and unmerged.
- Candidate identity is always the branch HEAD; exact-head CI and its uploaded artifact are the authoritative verification records.

## Preserved Foundation
SIF Core preserves append-only events, optimistic concurrency, hash-chain integrity, deterministic replay, resumable projections, SHA-256/CAS integrity, evidence/provenance/knowledge/semantic/lineage registries, scoped authority, delegation attenuation, default-deny policy, durable outbox/inbox, PostgreSQL transactional contracts, Ed25519 attestations, capability-gated execution, reconstruction verification, secure federation, policy governance, evaluation/observability, and the Phase 6 semantic plane described below.

## Phase 3 Secure Federation
Preserved verified candidate capabilities include canonical federation envelopes, integrity, trust bundles, capability negotiation, sovereign local admission, durable federated inbox, bounded reconciliation/retry/recovery, transport identity binding, resource governance, fault injection, and crash-window verification.

## Phase 4 Policy & Governance
Preserved verified candidate capabilities include immutable policy bundles and versions, explicit lifecycle, historical resolution, overlap fail-closed behavior, deny-overrides-allow, provider-neutral OPA/Cedar-shaped integration boundaries, provider-result identity binding, deterministic evidence, non-widening federated policy metadata, bounded resources, and caller-immutable evidence ledgers.

## Phase 5 Evaluation & Observability
Preserved verified candidate capabilities include bounded deterministic trace/evidence correlation, structured TRACE/METRIC/LOG observation, sink isolation, deterministic evaluation records with candidate/environment provenance, candidate/artifact/environment-bound replay, explicit fault proof and distinct fault classifications, bounded parallel regression execution, and fail-closed promotion evidence.

## Phase 6 Knowledge / Semantic Plane
Implemented capabilities include:
- immutable/versioned ontology records with explicit DRAFT → ACTIVE → RETIRED lifecycle;
- deterministic ontology/content identity, bounded concept/mapping counts, and caller-immutable reads;
- deterministic semantic compatibility with explicit mappings and fail-closed handling of missing, ambiguous, low-confidence, approximate, and conditional mappings;
- evidence-qualified epistemic knowledge with temporal validity and explicit LOCAL / REMOTE_EVIDENCE / LEGACY attribution;
- contradiction detection at a requested point in time;
- supersession/retraction represented as new records without rewriting historical assertions;
- immutable provenance graph with parent validation, cycle rejection, bounded ancestry traversal, and graph digest;
- append-only semantic operation log with deterministic replay and exact ontology/version filtering;
- explicit legacy knowledge handoff preserving legacy identity/provenance and returning `authorityWidened: false`;
- bounded ontology, knowledge, provenance, replay, and payload resources;
- executable acceptance coverage F6-001..F6-060.

## Verification State
The current Phase 6 candidate is accepted only when the exact branch HEAD has passed the full SIF Core CI workflow. The workflow verifies checkout identity, strict build/tests, live PostgreSQL integration, both crash-window characterizations, candidate archive construction/verification, and candidate artifact upload.

Dynamic CI run numbers, IDs, artifact IDs, and artifact digests are intentionally not committed into this mutable state file because doing so creates a self-referential provenance loop.

## Release / Promotion State
- `sif-core` package remains `0.5.0`.
- No version bump, registry publication, release tag, or merge to `main` is implied.
- No production semantic graph/knowledge-store deployment is claimed.
- No automatic truth determination or authority promotion is claimed.
- Phase 6 remains an unpublished draft candidate pending explicit promotion/release handling.

## Explicit Unknown / Not Claimed
- production distributed knowledge graph or external ontology registry;
- semantic consensus across autonomous domains;
- automatic truth determination from confidence or compatibility;
- production-scale knowledge graph HA/performance;
- KMS/HSM integration;
- distributed consensus;
- exactly-once external side effects;
- automatic authority promotion from knowledge, provenance, telemetry, or semantic compatibility.

## Governing Laws
- configured != live != usable != production-safe
- exit code != semantic success
- event history is authoritative
- snapshots/projections/semantic indexes are derived
- meaning is versioned; history is not silently rewritten
- ambiguity fails closed
- knowledge is not authority
- remote evidence is not local authority
- legacy handoff never widens authority
- no promotion without reproducible evidence
- concurrency/resource limits must be executable, not documentary only
- artifact provenance must identify the exact candidate content

## Release Discipline
`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
