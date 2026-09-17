# SIF Core — 0.5.0 Kernel + Verified Phases 2–9

## Package identity

The package identity remains `sif-core@0.5.0`. The current canonical cumulative preservation line is `feat/sif-core-1.0.0-knowledge-semantic`, carrying the verified Phase 2–9 implementation and promotion history while `main` remains the preserved Genesis line by design.

## Verified implementation scope

The preserved SIF Core tree contains the verified kernel foundation plus:

- Phase 2 — Live PostgreSQL persistence and crash-window characterization;
- Phase 3 — Secure federation, durable inbox, retry/recovery, and resource controls;
- Phase 4 — Policy and governance with versioned policy bundles, fail-closed admission, attributable evidence, and bounded evaluation;
- Phase 5 — Evaluation and observability with trace/evidence correlation, replay, fault injection, regression semantics, and promotion evidence;
- Phase 6 — Knowledge / Semantic plane with versioned ontology, semantic compatibility, epistemic knowledge, provenance graph, semantic replay, and legacy handoff;
- Phase 7 — Systemic / Ecological plane with deterministic bounded world-models, scenario events, strategy actions, institutions, experiments, replay, and cross-phase evidence;
- Phase 8 — Reflexive / Continuity plane with self-model, snapshots, lineage, controlled improvement, succession, preservation manifests, reconstruction verification, and continuity replay;
- Phase 9 — Sovereign Products with explicit version-pinned product adapters, deterministic request/response handling, fail-closed capability/authority/version/operation enforcement, append-only product evidence, and replay verification.

F6-001..F6-060, F7-001..F7-060, F8-001..F8-060, and F9-001..F9-060 are executable acceptance coverage in the corresponding test suites.

## Verification rule

The authoritative candidate identity is the exact branch HEAD. The authoritative verification record is a successful SIF Core CI run whose `head_sha` exactly equals that candidate. The current canonical preservation state is `5a57827bb52a5e82a59dfa329ab77bcd659eea85`; its live verification is the exact-head SIF Core CI run associated with that SHA.

The established full verification gate covers exact checkout and identity, strict build/tests, package acceptance coverage, live PostgreSQL integration, federated inbox crash-window characterization, PostgreSQL crash-window characterization, unpublished candidate archive construction and verification, artifact upload, and cleanup.

## Release boundary

Phase 0–9 implementation, verification, and promotion work is complete for the currently defined roadmap. No package version bump, registry publication, merge to `main`, release tag, production deployment, direct external product integration, autonomous external action, or automatic authority promotion is implied by this verification state.

No Phase 10 is currently defined. Any future phase requires a new explicit specification and evidence-gated implementation cycle.
