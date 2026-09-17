# SIF Core — 0.5.0 Kernel + Candidate Phases 2–7

## Package identity

The package identity remains `sif-core@0.5.0`. Later implementation milestones remain isolated candidate lines until a separate promotion/release decision.

## Verified foundation

The core event-sourcing, integrity, CAS, authority, provenance, replay, persistence, outbox/inbox, worker, projection, federation, policy-governance, evaluation/observability, and knowledge/semantic primitives remain preserved and are regression-tested by later candidate CI.

## Phase 6 Knowledge / Semantic candidate

The dedicated `feat/sif-core-1.0.0-knowledge-semantic` candidate adds immutable/versioned ontology lifecycle, deterministic semantic compatibility with fail-closed ambiguity handling, evidence-qualified temporal knowledge, contradiction detection, immutable provenance, semantic replay, legacy handoff with `authorityWidened: false`, and bounded resources.

F6-001..F6-060 are executable in `packages/sif-core/test/knowledge-semantic-acceptance.test.ts`.

## Phase 7 Systemic / Ecological candidate

The dedicated `feat/sif-core-1.1.0-systemic-ecological-plane` candidate adds:

- deterministic world-model identity spanning players, agents, strategies, markets, and institutions;
- explicit reference validation and executable resource ceilings;
- stable event ordering by `(step, id)` independent of input order;
- strategy actions restricted to `SET`, `ADD`, and `MULTIPLY`;
- institutional deny rules that block matching events before strategy actions;
- bounded scenario branches and experiment digests bound to scenario identity;
- deterministic replay descriptors and repeat-run determinism verification;
- semantic-state digest validation and cross-phase evidence attribution;
- no external network, shell, database mutation, or autonomous real-world action interface.

F7-001..F7-060 are executable in `packages/sif-core/test/systemic-ecological-acceptance.test.ts`.

## Verification rule

The authoritative candidate identity is the branch HEAD. The authoritative verification record is a successful SIF Core CI run whose `head_sha` exactly equals that candidate. Dynamic CI run/artifact identifiers are intentionally excluded from mutable state documents to prevent self-invalidating provenance.

## Release boundary

No package version bump, registry publication, merge to `main`, production simulation deployment, real-world forecasting claim, autonomous action, or authority promotion is implied by candidate verification.

See the phase specifications, implementation contracts, test matrices, evidence ledgers, and CI records for exact boundaries.
