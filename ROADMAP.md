# SIF Roadmap

## Phase 0 — Genesis
Repository identity, architecture record, verification discipline.

## Phase 1 — Verified Kernel 0.1–0.5
Event sourcing, integrity, CAS, authority, policy, provenance, persistence, outbox/inbox, workers.

Status: verified kernel baseline preserved.

## Phase 2 — Live Persistence 0.6
Real PostgreSQL integration, migration harness, concurrency tests, crash-window characterization, durable projections and worker lifecycle.

Status: implementation-level persistence gates remain preserved and regression-tested by later candidate CI.

## Phase 3 — Secure Federation
Trust bundles, capability negotiation, signed federated messages/events, replay-safe reconciliation, durable inbox, retry/recovery and resource controls.

Status: verified implementation candidate preserved on its dedicated branch. No publication, merge to main, or production federation claim.

## Phase 4 — Policy and Governance
Versioned policy bundles, immutable policy digests, explicit lifecycle, historical resolution, deny-overrides/default-deny, provider-neutral OPA/Cedar-shaped adapters, attributable evidence, bounded evaluation, and federation-to-local-policy sovereignty.

Status: verified implementation candidate preserved on its dedicated branch. Promotion remains a separate explicit boundary.

## Phase 5 — Evaluation and Observability
Trace/evidence correlation, replayable evaluations, fault injection, bounded regression execution, and promotion evidence.

Status: verified implementation candidate preserved; production telemetry deployment is not claimed.

## Phase 6 — Knowledge / Semantic Plane
Versioned immutable ontology, semantic compatibility, epistemic state, semantic replay, provenance graph and legacy knowledge handoff.

Status: verified implementation candidate preserved on `feat/sif-core-1.0.0-knowledge-semantic`; F6-001..F6-060 executable acceptance coverage and exact-head CI verification are present. Promotion remains a separate explicit boundary.

## Phase 7 — Systemic / Ecological Plane
Deterministic bounded world-models for players, agents, strategies, markets, institutions, state variables, scheduled events, experiments, replay, and cross-phase evidence.

Status: verified implementation candidate on `feat/sif-core-1.1.0-systemic-ecological-plane`; F7-001..F7-060 executable acceptance coverage has passed exact-head CI. Promotion remains a separate explicit boundary.

## Phase 8 — Reflexive / Continuity Plane
Self-model, controlled self-improvement, reconstruction, succession, identity lineage and long-term preservation.

Status: implemented verified candidate preserved on `feat/sif-core-1.2.0-reflexive-continuity`; its acceptance coverage is regression-tested by the later Phase 9 candidate CI. Promotion remains a separate explicit boundary.

## Phase 9 — Sovereign Products
Reusable SIF capabilities exposed to Lara OS/REIE, QADRIX, Sovereign Library and future sovereign applications through explicit adapters.

Status: implemented candidate on `feat/sif-core-1.3.0-sovereign-products`; F9-001..F9-060 executable acceptance coverage passed exact-head CI at implementation HEAD `fdb2a2e542f1745612e0617668258550bba5b12f`. Documentation reconciliation followed without changing the implementation. The resulting branch HEAD must pass the same exact-head CI before final promotion/freeze.

## Release Discipline
Every phase follows:

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

Promotion requires evidence. No phase is considered complete because code merely exists.
