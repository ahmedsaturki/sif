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
- `main` remains preserved and unmerged.
- Phases 2–5 remain preserved on their dedicated candidate lines.
- `feat/sif-core-1.0.0-knowledge-semantic` is the current Phase 6 candidate line.
- PR #6 is open, draft, unmerged, and targets the verified Phase 5 candidate line.
- Candidate identity is always the branch HEAD; exact-head CI and its uploaded artifact are the authoritative verification records.

## Preserved Foundation
The SIF Core foundation includes append-only events, optimistic concurrency, per-stream hash chains, deterministic replay, resumable projections, SHA-256 integrity, filesystem CAS, evidence/provenance/knowledge/semantic/lineage registries, scoped authority, delegation attenuation, default-deny policy, durable outbox/inbox, PostgreSQL transactional contracts, Ed25519 attestations, capability-gated execution, self-model/reconstruction verification, secure federation, policy governance, evaluation/observability, and the Phase 6 semantic plane described below.

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
- bounded ontology, knowledge, provenance, replay, and payload resources.

## Phase 6 Evidence State
- F6-001..F6-060 are executable in `packages/sif-core/test/knowledge-semantic-acceptance.test.ts`.
- Exact-head CI has verified the current Phase 6 candidate checkout, strict build/tests, live PostgreSQL integration, both crash-window characterizations, candidate archive construction/verification, and candidate artifact upload.
- The acceptance matrix and evidence ledger map each row to an executable test.
- Dynamic CI run numbers, IDs, artifact IDs, and artifact digests are intentionally not committed into mutable state docs to avoid self-referential provenance loops.

## Verification / Artifact Provenance
- The authoritative verification record is the successful SIF Core CI workflow run whose `head_sha` exactly equals the current branch HEAD.
- That run's uploaded unpublished candidate artifact and digest are authoritative for that exact commit.
- CI independently verifies checkout identity, the committed test tree, live PostgreSQL behavior, crash windows, candidate archives, archive hashes, and artifact upload.

## Release / Promotion State
- `sif-core` package remains `0.5.0`.
- No version bump, registry publication, release tag, or merge to `main` has been performed.
- No production semantic graph/knowledge store deployment claim has been made.
- Phase 6 PR #6 remains a draft candidate pending explicit promotion/release handling.

## Explicit Unknown / Not Claimed
- production distributed knowledge graph
- external ontology registry integration
- semantic consensus across autonomous domains
- automatic truth determination from confidence or compatibility
- production-scale knowledge graph HA/performance
- KMS/HSM integration
- distributed consensus
- exactly-once external side effects
- automatic authority promotion from knowledge, provenance, telemetry, or semantic compatibility

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
- artifact provenance must identify the exact candidate content

## Release Discipline
`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
