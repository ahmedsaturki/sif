# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation grows through evidence-gated, dependency-light kernel layers.

## Current promoted line

- Phase 2 Live PostgreSQL, Phase 3 Secure Federation, Phase 4 Policy & Governance, Phase 5 Evaluation & Observability, Phase 6 Knowledge / Semantic, Phase 7 Systemic / Ecological, Phase 8 Reflexive / Continuity, and Phase 9 Sovereign Products are preserved on dedicated branches.
- The cumulative Phase 7–9 tree is preserved in the historical Core line `feat/sif-core-1.0.0-knowledge-semantic`, the canonical cumulative Core preservation branch. The current promoted application line is `feat/sif-adoption-layer-1.0.0`.
- Final repository hardening: PR #39 pinned application CI GitHub Actions and the REIE PostgreSQL service image; PR #40 recorded the resulting enforcement/provenance state.
- Phase 9 exact implementation HEAD: `e1a0b5d47caabd61016cad92b0bc31c83ef01693`.
- Phase 9 promotion commit: `b9345786727cbd2692447d1ce53d472d7670b3df`.
- Phase 8 promotion commit: `963a268e205fb0d2b0dcaf0e184a25ab91befd73`.
- Phase 7/9 cumulative promotion into the Phase 6 line: `77a605a936115815c2e833f6c4667f0e353aefbd`.
- The package version remains `0.5.0`; preservation and promotion do not imply package publication.
- REIE Operational Platform 2.0.0 is a separate product integration release on the isolated adoption line; it does not change the Core package version.

## Phase 9 Sovereign Products

Phase 9 exposes selected SIF capabilities through explicit, versioned adapters for `LARA_OS_REIE`, `QADRIX`, and `SOVEREIGN_LIBRARY`.

The boundary provides immutable-to-callers descriptors, deterministic request normalization and digests, fail-closed capability/authority/version/operation enforcement, explicit injected handlers, bounded adapter registration, append-only hash-linked product evidence, and deterministic request/response replay verification.

The adapter layer does not claim direct production integration, hidden network/database/browser/queue access, credential use, autonomous external actions, or automatic authority promotion. Product-specific work enters through explicit handlers only.

F9-001..F9-060 are executable in `packages/sif-core/test/sovereign-products.test.ts`.

## REIE Operational Product Release 2.0.0

The Phase 9 sovereign-product adapter surface has now been exercised by a complete Lara OS / REIE operational application layer on the isolated adoption line.

The promoted application line contains REIE Local Core 1.0.0, deterministic ingestion 1.1.0, and REIE Operational Platform 2.0.0. The operational release adds evidence-bearing extraction candidates, human review, durable operational state, explicit relations, price history, opportunity projection, governed agents, a loopback-only local API/dashboard, an optional Playwright browser worker, and an optional PostgreSQL adapter.

Release commit: `b7b5d2298e3fe07d7c377b7715e4760ecbde6967` via PR #33.

This is an application-layer promotion, not a new SIF roadmap phase. The frozen `sif-core@0.5.0` contract remains unchanged.

## REIE Governed Host 2.1.0

REIE Operational Platform 2.0.0 has been completed by an executable governed host on the isolated adoption line. The host composes SIF Adoption, REIE Local Core, the local operational API, public-source browser collection, and durable raw-source provenance.

Release merge commit: `809d602542f26df38333fafded3e14227bca183d` via PR #35.

The host release does not change the frozen `sif-core@0.5.0` contract and does not create a new SIF roadmap phase.

## Verification boundary

Each cumulative promotion layer was independently exact-head verified before promotion. The canonical cumulative branch is the authoritative current source state, and its current HEAD must be covered by a successful exact-head SIF Core CI run before that state is treated as verified.

The established full verification gate covers exact checkout and identity, strict TypeScript build/tests, package acceptance coverage, live PostgreSQL integration, federated inbox and PostgreSQL crash-window characterization, unpublished archive construction and integrity verification, exact-head artifact upload, and cleanup.

Current-state documents intentionally avoid embedding dynamic CI run IDs, artifact IDs, or the current branch SHA, because changing those values in a document would require another state commit and invalidate the reference.

## Repository governance

Repository-level merge protection is specified in `REPOSITORY_GOVERNANCE.md`. The canonical branch should require pull requests and the `SIF Core CI / verify-core` check, along with review, conversation-resolution, no-force-push, and no-deletion controls.

The tree now includes `CODEOWNERS`, a pull-request template, PR-targeted CI, explicit workflow read-only permissions, a 15-minute verification timeout, and deterministic Node/npm/TypeScript build metadata.

The connected GitHub administration surface currently reports no active Rulesets. Live branch metadata currently reports `protected: false` for the canonical branch and `main`; the detailed branch-protection endpoint is not readable through the connected integration, so the exact protection configuration cannot be inspected or changed here. The repository documentation records this observed gap and the intended governance contract without claiming that branch protection is active.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

The current Phase 0–9 roadmap is closed. No Phase 10 is defined. No merge to `main`, package publication, release tag, production deployment, or direct external product integration is implied.

All pull requests currently created in the repository are closed. PR #35 promoted REIE Governed Host 2.1.0 into the adoption line after exact-head verification. PR #33 promoted REIE Operational Platform 2.0.0 into the adoption line after exact-head verification. PRs #9–#13 completed the later promotion/hardening chain; PR #39 completed application CI supply-chain hardening; PR #40 recorded that final hardening in the canonical state documents. PRs #1–#6 are retained only as closed historical candidate records.

## Cleanup note

Non-canonical historical and maintenance refs remain in the repository, including the temporary test refs `tmp-test-no` and `tmp-test-no2`. The available GitHub connector exposes branch creation and movement but does not expose branch-ref deletion, so non-canonical refs are intentionally left untouched rather than risking an unsafe workaround.

## License

Apache-2.0. See `LICENSE`.
