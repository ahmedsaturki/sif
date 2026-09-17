# SIF Roadmap

## Phase 0 — Genesis
Repository identity, architecture record, verification discipline.

## Phase 1 — Verified Kernel 0.1–0.5
Event sourcing, integrity, CAS, authority, policy, provenance, persistence, outbox/inbox, workers.

Status: verified kernel baseline preserved.

## Phase 2 — Live Persistence 0.6
Real PostgreSQL integration, migration harness, concurrency tests, crash-window characterization, durable projections and production-style worker lifecycle.

Status: implementation-level persistence gates remain preserved and regression-tested by later candidate CI.

## Phase 3 — Secure Federation
SPIFFE/mTLS adapter boundary, trust bundles, capability negotiation, signed federated messages/events, replay-safe reconciliation, durable inbox, retry/recovery and resource controls.

Status: implementation candidate verified by exact-head CI on its dedicated branch. No publication, merge to main, or production federation claim.

## Phase 4 — Policy and Governance
Versioned policy bundles, immutable policy digests, explicit lifecycle, timestamp-aware historical resolution, local deny-overrides/default-deny, provider-neutral OPA/Cedar-shaped adapters, attributable decision evidence, bounded evaluation resources, and federation-to-local-policy sovereignty.

Status: implementation candidate on `feat/sif-core-0.8.0-policy-governance`; F4-001..F4-040 executable acceptance coverage and exact-head CI verification are present. Promotion remains a separate explicit boundary.

## Phase 5 — Evaluation and Observability
OpenTelemetry, trace/evidence correlation, replayable evaluations, fault injection, regression suites and production-to-eval qualification.

Status: implementation candidate on `feat/sif-core-0.9.0-evaluation-observability`; F5-001..F5-060 executable acceptance coverage and exact-head CI verification are present. No publication, merge, or production observability claim.

## Phase 6 — Knowledge / Semantic Plane
Versioned ontology, semantic compatibility, epistemic state, semantic replay, provenance graph and legacy knowledge handoff.

Status: implementation candidate on `feat/sif-core-1.0.0-knowledge-semantic-plane`; F6-001..F6-060 acceptance coverage is present. Full exact-head CI verification pending for this branch candidate.

## Phase 7 — Systemic / Ecological Plane
Agents, players, strategies, markets, institutions, system dynamics, event simulation and bounded world-model experiments.

## Phase 8 — Reflexive / Continuity Plane
Self-model, controlled self-improvement, reconstruction, succession, identity lineage and long-term preservation.

## Phase 9 — Sovereign Products
Reusable SIF capabilities exposed to Lara OS/REIE, QADRIX, Sovereign Library and future sovereign applications through explicit adapters.

## Release Discipline
Every phase follows:

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

Promotion requires evidence. No phase is considered complete because code merely exists.
