# SIF Roadmap

## Phase 0 — Genesis
Repository identity, architecture record, verification discipline.

## Phase 1 — Verified Kernel 0.1–0.5
Event sourcing, integrity, CAS, authority, policy, provenance, persistence, outbox/inbox, workers.

Status: verified kernel baseline preserved.

## Phase 2 — Live Persistence 0.6
Real PostgreSQL integration, migration harness, concurrency tests, crash recovery, durable projections and production-style worker lifecycle.

Current status: **core live PostgreSQL verification gates passed** against PostgreSQL 16 in GitHub Actions run 93. Verified scenarios are concurrent same-stream serialization, atomic transaction rollback, projection checkpoint persistence/deterministic round-trip, exclusive outbox lease/reclaim/owner-fencing, and explicit before-commit / after-commit backend termination characterization. The CI job also passed strict build, 27/27 unit tests, artifact identity verification, and schema bootstrap.

Release boundary remains explicit: arbitrary crash-point coverage and full recovery/reconciliation after external database/network faults are not claimed by this milestone. Production-scale PostgreSQL performance/HA, network-partition recovery, secure federation, distributed consensus, and exactly-once external effects remain later-stage work.

## Phase 3 — Secure Federation
SPIFFE/mTLS boundary, trust bundles, capability negotiation, signed federated messages/events, replay-safe reconciliation.

## Phase 4 — Policy and Governance
OPA/Cedar adapter boundary, policy versioning, policy provenance, authorization decisions, governance artifacts.

## Phase 5 — Evaluation and Observability
OpenTelemetry, trace/evidence correlation, replayable evaluations, fault injection, regression suites and production-to-eval qualification.

## Phase 6 — Knowledge / Semantic Plane
Versioned ontology, semantic compatibility, epistemic state, semantic replay, provenance graph and legacy knowledge handoff.

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
