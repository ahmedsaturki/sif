# SIF Roadmap

## Phase 0 — Genesis
Repository identity, architecture record, verification discipline.

## Phase 1 — Verified Kernel 0.1–0.5
Event sourcing, integrity, CAS, authority, policy, provenance, persistence, outbox/inbox, workers.

Status: verified kernel baseline preserved.

## Phase 2 — Live Persistence 0.6
Real PostgreSQL integration, migration harness, concurrency tests, crash-window characterization, durable projections and production-style worker lifecycle.

Current status: **implementation-level 0.6 persistence gates verified on PostgreSQL 16.15**. Latest CI run `209` checks out exact candidate head `38b7cc348a5adabc06d782ad6f475bbcb692da06` and passes exact-checkout verification, strict TypeScript build/tests, schema bootstrap, four live PostgreSQL scenarios, explicit crash-window characterization, candidate archive build/verification, and artifact upload.

Hardening included regression coverage for delegated-authority lifetime, locale-independent canonicalization, application metadata binding in event digests, and PostgreSQL inherited-append/stream-head synchronization.

Release boundary remains explicit: arbitrary crash-point coverage and full recovery/reconciliation after external database/network faults are not claimed. Production-scale PostgreSQL performance/HA, network-partition recovery, secure federation, distributed consensus, and exactly-once external effects remain later-stage work.

The artifact/evidence gate for the current candidate is complete. The package version remains intentionally `0.5.0`; no `0.6.0` tag or publication has been performed.

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
