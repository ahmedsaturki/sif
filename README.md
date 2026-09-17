# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation grows through evidence-gated, dependency-light kernel layers.

## Current candidate line

- Verified kernel baseline is preserved.
- Phase 2 Live PostgreSQL verification is preserved by later candidate CI.
- Phase 3 Secure Federation, Phase 4 Policy & Governance, Phase 5 Evaluation & Observability, and Phase 6 Knowledge / Semantic remain preserved on dedicated candidate lines.
- Phase 7 Systemic / Ecological is the current unpublished implementation candidate on `feat/sif-core-1.1.0-systemic-ecological-plane`.
- The package version remains `0.5.0`; candidate phases do not imply publication.

## Phase 7 Systemic / Ecological

Phase 7 adds a dependency-free bounded world-model layer for systemic experiments: players, agents, strategies, markets, institutions, numeric state, scheduled events, scenario branches, deterministic replay, and cross-phase evidence references.

Its runtime boundary is deliberately simulation-only. Institutional blocking is fail-closed, event execution is deterministic, resources are explicitly bounded, experiment digests include scenario identity, and simulation outputs cannot widen authority or silently become observed/production truth.

F7-001..F7-060 are executable in `packages/sif-core/test/systemic-ecological-acceptance.test.ts`.

## Verification boundary

A successful exact-head SIF Core CI run verifies the exact source checkout and its unpublished candidate artifact. It does not claim production deployment, external market forecasting, autonomous real-world action, distributed consensus, or package publication.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

Promotion requires a separate explicit decision. No merge to `main`, version bump, or registry publication is implied by candidate verification.

## License

Apache-2.0. See `LICENSE`.
