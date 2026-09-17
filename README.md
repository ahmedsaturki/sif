# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation grows through evidence-gated, dependency-light kernel layers.

## Current promoted line

- Phase 2 Live PostgreSQL, Phase 3 Secure Federation, Phase 4 Policy & Governance, Phase 5 Evaluation & Observability, Phase 6 Knowledge / Semantic, Phase 7 Systemic / Ecological, Phase 8 Reflexive / Continuity, and Phase 9 Sovereign Products are preserved on dedicated branches.
- The cumulative Phase 7–9 tree is promoted into the preserved Phase 6 line `feat/sif-core-1.0.0-knowledge-semantic`.
- Canonical preservation HEAD: `5a57827bb52a5e82a59dfa329ab77bcd659eea85`.
- Phase 9 exact implementation HEAD: `e1a0b5d47caabd61016cad92b0bc31c83ef01693`.
- Phase 9 promotion commit: `b9345786727cbd2692447d1ce53d472d7670b3df`.
- Phase 8 promotion commit: `963a268e205fb0d2b0dcaf0e184a25ab91befd73`.
- Phase 7/9 cumulative promotion into the Phase 6 line: `77a605a936115815c2e833f6c4667f0e353aefbd`.
- Current closure documentation reconciliation: `5a57827bb52a5e82a59dfa329ab77bcd659eea85`.
- The package version remains `0.5.0`; preservation and promotion do not imply package publication.

## Phase 9 Sovereign Products

Phase 9 exposes selected SIF capabilities through explicit, versioned adapters for `LARA_OS_REIE`, `QADRIX`, and `SOVEREIGN_LIBRARY`.

The boundary provides immutable-to-callers descriptors, deterministic request normalization and digests, fail-closed capability/authority/version/operation enforcement, explicit injected handlers, bounded adapter registration, append-only hash-linked product evidence, and deterministic request/response replay verification.

The adapter layer does not claim direct production integration, hidden network/database/browser/queue access, credential use, autonomous external actions, or automatic authority promotion. Product-specific work enters through explicit handlers only.

F9-001..F9-060 are executable in `packages/sif-core/test/sovereign-products.test.ts`.

## Verification boundary

Each cumulative promotion layer was independently exact-head verified before promotion. The final canonical preservation state is identified by the exact HEAD above; the authoritative live proof is the SIF Core CI run whose `head_sha` exactly equals that HEAD. Current-state documents intentionally avoid embedding dynamic run and artifact identifiers.

The established full verification gate covers exact checkout and identity, strict TypeScript build/tests, package acceptance coverage, live PostgreSQL integration, federated inbox and PostgreSQL crash-window characterization, unpublished archive construction and integrity verification, exact-head artifact upload, and cleanup.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

The current Phase 0–9 roadmap is closed. No Phase 10 is defined. No merge to `main`, package publication, release tag, production deployment, or direct external product integration is implied.

All PRs #1–#11 are closed. PRs #9–#11 completed the cumulative Phase 7→8→9 promotion chain; PRs #1–#6 are retained only as closed historical candidate records.

## Cleanup note

The only remaining known non-semantic refs are `tmp-test-no` and `tmp-test-no2`. They are inert temporary test branches. The available GitHub connector exposes branch creation and movement but does not expose branch-ref deletion, so they are intentionally left untouched rather than risking an unsafe workaround.

## License

Apache-2.0. See `LICENSE`.
