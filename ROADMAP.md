# SIF Roadmap

## Phase 0 — Genesis
Repository identity, architecture record, verification discipline.

Status: preserved Genesis baseline on `main`.

## Phase 1 — Verified Kernel 0.1–0.5
Event sourcing, integrity, CAS, authority, policy, provenance, persistence, outbox/inbox, workers.

Status: verified kernel baseline preserved.

## Phase 2 — Live Persistence 0.6
Real PostgreSQL integration, migration harness, concurrency tests, crash-window characterization, durable projections and worker lifecycle.

Status: verified implementation preserved on `feat/sif-core-0.6.0-live-postgres`; historical PR #2 is superseded by later cumulative promotion and remains outside `main`.

## Phase 3 — Secure Federation
Trust bundles, capability negotiation, signed federated messages/events, replay-safe reconciliation, durable inbox, retry/recovery and resource controls.

Status: verified implementation preserved on `feat/sif-core-0.7.0-secure-federation`; historical PR #3 is superseded by later cumulative promotion and remains outside `main`.

## Phase 4 — Policy and Governance
Versioned policy bundles, immutable policy digests, explicit lifecycle, historical resolution, deny-overrides/default-deny, provider-neutral OPA/Cedar-shaped adapters, attributable evidence, bounded evaluation, and federation-to-local-policy sovereignty.

Status: verified implementation preserved on `feat/sif-core-0.8.0-policy-governance`; historical PR #4 is superseded by later cumulative promotion and remains outside `main`.

## Phase 5 — Evaluation and Observability
Trace/evidence correlation, replayable evaluations, fault injection, bounded regression execution, and promotion evidence.

Status: verified implementation preserved on `feat/sif-core-0.9.0-evaluation-observability`; historical PR #5 is superseded by later cumulative promotion and remains outside `main`.

## Phase 6 — Knowledge / Semantic Plane
Versioned immutable ontology, semantic compatibility, epistemic state, semantic replay, provenance graph and legacy knowledge handoff.

Status: verified and preserved on `feat/sif-core-1.0.0-knowledge-semantic`. The branch is now the canonical cumulative preservation line containing verified Phase 7, Phase 8, and Phase 9 promotion results. Historical PR #6 remains a review record and is superseded by the completed cumulative line.

## Phase 7 — Systemic / Ecological Plane
Deterministic bounded world-models for players, agents, strategies, markets, institutions, state variables, scheduled events, experiments, replay, and cross-phase evidence.

Status: implemented, exact-head verified, promoted through PR #9 into the preserved Phase 6 line. F7-001..F7-060 passed on the exact candidate HEAD before promotion.

## Phase 8 — Reflexive / Continuity Plane
Self-model, controlled self-improvement, reconstruction, succession, identity lineage and long-term preservation.

Status: implemented, exact-head verified, promoted through PR #10 into the preserved Phase 7 line, then included in the final Phase 6 cumulative line. F8-001..F8-060 passed on the exact candidate HEAD before promotion.

## Phase 9 — Sovereign Products
Reusable SIF capabilities exposed to Lara OS/REIE, QADRIX, Sovereign Library and future sovereign applications through explicit adapters.

Status: implemented, exact-head verified, promoted through PR #11 into the preserved Phase 8 line, then included in the cumulative Phase 7 and Phase 6 promotion chain. F9-001..F9-060 passed on exact implementation HEAD `e1a0b5d47caabd61016cad92b0bc31c83ef01693` in Run #530.

### Phase 9 product realization — Lara OS / REIE 2.0.0

A post-Phase-9 application-layer realization was completed on the isolated `feat/sif-adoption-layer-1.0.0` line and promoted through PR #33. It does not create a Phase 10. The release adds deterministic ingestion, evidence-first extraction and human review, durable operational state, explicit relations, price history and opportunity projections, governed agents, local API/dashboard, optional Playwright browser collection, and optional PostgreSQL persistence. The verified merge commit is `b7b5d2298e3fe07d7c377b7715e4760ecbde6967`.

### REIE governed host realization — 2.1.0

The post-Phase-9 REIE product line now includes an executable governed host that composes the SIF Adoption Gateway with REIE runtime services. PR #35 promoted this host and durable source-provenance boundary into the adoption line. This remains an application-layer realization and does not define Phase 10.

## Roadmap Boundary
Phase 0–9 is the complete currently defined roadmap. No Phase 10 is currently defined. Any future phase requires a new explicit specification and evidence-gated implementation cycle.

## Release Discipline
Every phase follows:

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

Promotion requires evidence. No phase is considered complete because code merely exists. `main` remains the preserved Genesis line by design; promotion of a verified phase does not imply package publication or production deployment.