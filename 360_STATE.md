# SIF 360° State

## Identity
- Repository: `ahmedsaturki/sif`
- Product: Sovereign Intelligence Fabric
- Current package baseline: `SIF Core 0.5.0`
- Verified integration foundation: Phase 2 Live PostgreSQL
- Current implementation candidate: Phase 6 Knowledge / Semantic Plane
- Implementation language: TypeScript
- Core dependency policy: dependency-free kernel
- Primary persistence target: PostgreSQL

## Repository State
- `main` remains at the preserved Genesis line and has not been merged with later candidate phases.
- `feat/sif-core-0.5.0` remains the preserved kernel baseline.
- `feat/sif-core-0.6.0-live-postgres` remains the preserved Phase 2/live-persistence candidate line.
- `feat/sif-core-0.7.0-secure-federation` remains the preserved Phase 3 candidate line.
- `feat/sif-core-0.8.0-policy-governance` remains the preserved Phase 4 candidate line.
- `feat/sif-core-0.9.0-evaluation-observability` remains the preserved Phase 5 candidate line.
- `feat/sif-core-1.0.0-knowledge-semantic-plane` is the current Phase 6 candidate line.
- PR #5 remains open, draft, and unmerged as the preserved Phase 5 candidate record.
- PR #8 remains open, draft, and unmerged as the current Phase 6 candidate record.
- The current candidate identity is always the branch HEAD; exact-head CI and its uploaded artifact are the authoritative verification/provenance records.

## Preserved Foundation
The SIF Core foundation includes append-only events, optimistic concurrency, per-stream hash chains, deterministic replay, resumable projections, SHA-256 integrity, filesystem CAS, evidence/provenance/knowledge/semantic/lineage registries, scoped authority, delegation attenuation, default-deny policy, durable outbox/inbox, PostgreSQL transactional contracts, Ed25519 attestations, capability-gated execution, self-model/reconstruction verification, secure federation, policy governance, evaluation/observability, and the Phase 6 semantic boundary below.

## Phase 5 Verification Preservation
Phase 5 candidate `feat/sif-core-0.9.0-evaluation-observability` has an exact-head successful CI record covering checkout identity, strict build/tests, live PostgreSQL integration, federation/PostgreSQL crash windows, archive verification, and unpublished artifact upload. Dynamic CI identifiers remain outside mutable state documents.

## Phase 6 Knowledge / Semantic Plane
Implemented and exact-head verified capabilities include:
- deterministic, versioned ontology definitions with lifecycle and temporal effective windows;
- fail-closed activation when active ontology versions overlap;
- timestamp-aware ontology resolution with ambiguity/not-found errors;
- provider-neutral semantic compatibility classification with structural-subset checking within the declared compatibility boundary;
- explicit epistemic status, bounded confidence, attributable sources, normalized observation time, and derivation lineage;
- bounded provenance graph with explicit node/edge identity and cycle prevention;
- semantic replay descriptors bound to ontology, epistemic, provenance, subject, and proposition identity;
- legacy knowledge handoff that preserves source identity and reports unmapped records instead of guessing mappings;
- deterministic semantic-context hashing with explicit byte/resource bounds;
- executable acceptance coverage F6-001..F6-060.

## Phase 6 Evidence State
- Implementation branch created directly from the verified Phase 5 candidate HEAD.
- Acceptance matrix committed.
- Exact-head SIF Core CI verification: PASS on the current Phase 6 candidate HEAD.
- Strict committed TypeScript build/tests: PASS.
- Live PostgreSQL integration: PASS.
- Federated inbox crash-window characterization: PASS.
- PostgreSQL crash-window characterization: PASS.
- Candidate archive build: PASS.
- Candidate archive verification: PASS.
- Unpublished candidate artifact upload: PASS.
- Dynamic CI run numbers, run IDs, artifact IDs, and artifact digests are intentionally omitted from this mutable state document to avoid self-referential provenance.

## Release / Promotion State
- `sif-core` package remains `0.5.0`.
- No version bump has been performed.
- No registry publication or release tag has been performed.
- No merge to `main` has been performed.
- No production semantic infrastructure deployment claim has been made.
- No automatic promotion has been performed.

## Explicit Unknown / Not Claimed
- external ontology registry/service
- vector embeddings or semantic search service
- autonomous semantic inference
- production knowledge graph infrastructure
- distributed semantic consensus
- production-scale knowledge ingestion guarantees
- semantic correctness beyond the declared compatibility/evaluation boundary

## Governing Laws
- configured != live != usable != production-safe
- exit code != semantic success
- event history is authoritative
- snapshots/projections are derived
- no promotion without reproducible evidence
- remote evidence does not become local authority automatically
- semantic compatibility is not semantic correctness proof by itself
- legacy knowledge is never silently guessed into a new ontology
- provenance must remain attributable and acyclic
- artifact provenance must identify exact candidate content being promoted

## Release Discipline
`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
