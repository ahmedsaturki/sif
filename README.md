# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation grows through evidence-gated, dependency-light kernel layers.

## Current promoted line

- Phase 2 Live PostgreSQL, Phase 3 Secure Federation, Phase 4 Policy & Governance, Phase 5 Evaluation & Observability, Phase 6 Knowledge / Semantic, Phase 7 Systemic / Ecological, Phase 8 Reflexive / Continuity, and Phase 9 Sovereign Products are preserved on dedicated branches.
- The cumulative Phase 7–9 tree is promoted into the preserved Phase 6 line `feat/sif-core-1.0.0-knowledge-semantic`, which is the canonical cumulative preservation branch.
- Phase 9 exact implementation HEAD: `e1a0b5d47caabd61016cad92b0bc31c83ef01693`.
- Phase 9 promotion commit: `b9345786727cbd2692447d1ce53d472d7670b3df`.
- Phase 8 promotion commit: `963a268e205fb0d2b0dcaf0e184a25ab91befd73`.
- Phase 7/9 cumulative promotion into the Phase 6 line: `77a605a936115815c2e833f6c4667f0e353aefbd`.
- The package version remains `0.5.0`; preservation and promotion do not imply package publication.

## Phase 9 Sovereign Products

Phase 9 exposes selected SIF capabilities through explicit, versioned adapters for `LARA_OS_REIE`, `QADRIX`, and `SOVEREIGN_LIBRARY`.

The boundary provides immutable-to-callers descriptors, deterministic request normalization and digests, fail-closed capability/authority/version/operation enforcement, explicit injected handlers, bounded adapter registration, append-only hash-linked product evidence, and deterministic request/response replay verification.

The adapter layer does not claim direct production integration, hidden network/database/browser/queue access, credential use, autonomous external actions, or automatic authority promotion. Product-specific work enters through explicit handlers only.

F9-001..F9-060 are executable in `packages/sif-core/test/sovereign-products.test.ts`.

## Verification boundary

Each cumulative promotion layer was independently exact-head verified before promotion. The canonical cumulative branch is the authoritative current source state, and its current HEAD must be covered by a successful exact-head SIF Core CI run before that state is treated as verified.

The established full verification gate covers exact checkout and identity, strict TypeScript build/tests, package acceptance coverage, live PostgreSQL integration, federated inbox and PostgreSQL crash-window characterization, unpublished archive construction and integrity verification, exact-head artifact upload, and cleanup.

Current-state documents intentionally avoid embedding dynamic CI run IDs, artifact IDs, or the current branch SHA, because changing those values in a document would require another state commit and invalidate the reference.

## Repository governance

Repository-level merge protection is specified in `REPOSITORY_GOVERNANCE.md`. The canonical branch should require pull requests and the `SIF Core CI / verify-core` check, along with review, conversation-resolution, no-force-push, and no-deletion controls.

The tree now includes `CODEOWNERS`, a pull-request template, PR-targeted CI, explicit workflow read-only permissions, a 15-minute verification timeout, and deterministic Node/npm/TypeScript build metadata.

The connected GitHub administration surface currently exposes no active Rulesets or protected branches. The repository files therefore document and reinforce the governance contract but do not claim that the GitHub setting itself is active.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

The current Phase 0–9 roadmap is closed. No Phase 10 is defined. No merge to `main`, package publication, release tag, production deployment, or direct external product integration is implied.

All PRs #1–#15 are closed. PRs #9–#13 completed the later promotion/hardening chain; PRs #14–#15 completed final documentation reconciliation. PRs #1–#6 are retained only as closed historical candidate records.

## Cleanup note

Non-canonical historical and maintenance refs remain in the repository, including the temporary test refs `tmp-test-no` and `tmp-test-no2`. The available GitHub connector exposes branch creation and movement but does not expose branch-ref deletion, so non-canonical refs are intentionally left untouched rather than risking an unsafe workaround.

## License

Apache-2.0. See `LICENSE`.
