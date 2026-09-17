# SIF 360° State

## Identity
- Repository: `ahmedsaturki/sif`
- Product: Sovereign Intelligence Fabric
- Current package baseline: `SIF Core 0.5.0`
- Current implementation candidate: Phase 7 — Systemic / Ecological Plane
- Implementation language: TypeScript
- Core dependency policy: dependency-free kernel
- Primary persistence target: PostgreSQL

## Repository State
- `main` remains at the preserved Genesis line and is not merged with later candidate phases.
- Phases 2–6 remain preserved on their dedicated candidate lines.
- `feat/sif-core-1.1.0-systemic-ecological-plane` is the current Phase 7 candidate line.
- PR #9 is open, draft, and unmerged.
- Candidate identity is always the branch HEAD; exact-head CI and its uploaded artifact are the authoritative verification records.

## Preserved Foundation
SIF Core preserves append-only events, optimistic concurrency, hash-chain integrity, deterministic replay, resumable projections, SHA-256/CAS integrity, evidence/provenance/knowledge/semantic/lineage registries, scoped authority, delegation attenuation, default-deny policy, durable outbox/inbox, PostgreSQL transactional contracts, Ed25519 attestations, capability-gated execution, reconstruction verification, secure federation, policy governance, evaluation/observability, the Phase 6 semantic plane, and the Phase 7 simulation plane described below.

## Phase 6 Knowledge / Semantic Plane
Preserved verified candidate capabilities include immutable/versioned ontology lifecycle, deterministic semantic compatibility with fail-closed ambiguity handling, evidence-qualified temporal knowledge, contradiction detection, immutable provenance, semantic replay, legacy handoff with `authorityWidened: false`, and bounded resources.

## Phase 7 Systemic / Ecological Plane
Implemented capabilities include:
- canonical world-model identity across players, agents, strategies, markets, and institutions;
- explicit reference validation and executable resource ceilings;
- deterministic event ordering by `(step, id)`;
- strategy actions restricted to SET, ADD, and MULTIPLY over declared numeric state;
- institutional deny rules that block matching events before strategy actions;
- bounded scenario branching and independent experiment digests bound to scenario identity;
- deterministic simulation replay descriptors and repeat-run determinism verification;
- semantic-state digest validation and evidence attribution from KNOWLEDGE, POLICY, FEDERATION, EVALUATION, and SCENARIO sources;
- no external side-effect, network, shell, or autonomous real-world action interface.
- executable acceptance coverage F7-001..F7-060.

## Verification State
The current Phase 7 candidate has passed the full exact-head SIF Core CI workflow. The verified run covered exact checkout identity, strict TypeScript build/tests, live PostgreSQL integration, federated inbox and PostgreSQL crash-window characterization, candidate archive construction/verification, artifact upload, and cleanup.

Dynamic CI run numbers, IDs, artifact IDs, and artifact digests are intentionally not committed into this mutable state file because doing so creates a self-referential provenance loop.

## Release / Promotion State
- `sif-core` package remains `0.5.0`.
- No version bump, registry publication, release tag, or merge to `main` is implied.
- No production agent/market/institution deployment is claimed.
- No real-world forecasting or autonomous action claim is made.
- No simulation output becomes observed truth, production evidence, or authority through this plane.
- Phase 7 remains an unpublished draft candidate pending explicit promotion/release handling.

## Explicit Unknown / Not Claimed
- production distributed world-model or simulation platform;
- real-market forecasting accuracy;
- autonomous agents controlling external systems;
- production scheduler/actor runtime;
- distributed consensus;
- KMS/HSM integration;
- exactly-once external side effects;
- automatic authority promotion from simulation output, telemetry, knowledge, provenance, or semantic compatibility.

## Governing Laws
- configured != live != usable != production-safe
- exit code != semantic success
- event history is authoritative
- snapshots/projections/semantic indexes are derived
- meaning is versioned; history is not silently rewritten
- simulation is not reality
- simulation output is not observed truth
- ambiguity fails closed
- knowledge is not authority
- remote evidence is not local authority
- legacy handoff never widens authority
- simulation state never widens authority
- no promotion without reproducible evidence
- concurrency/resource limits must be executable, not documentary only
- artifact provenance must identify the exact candidate content

## Release Discipline
`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
