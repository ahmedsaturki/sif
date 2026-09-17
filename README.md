# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation grows through evidence-gated, dependency-light kernel layers.

## Current promoted line

- The verified kernel baseline and preserved candidate phases remain available on their dedicated lines.
- Phase 2 Live PostgreSQL, Phase 3 Secure Federation, Phase 4 Policy & Governance, Phase 5 Evaluation & Observability, Phase 6 Knowledge / Semantic, Phase 7 Systemic / Ecological, and Phase 8 Reflexive / Continuity remain preserved on their dedicated verified lines.
- Phase 9 Sovereign Products has been implemented, exact-head verified, and promoted into `feat/sif-core-1.2.0-reflexive-continuity` through PR #11.
- Phase 9 exact-head implementation: `e1a0b5d47caabd61016cad92b0bc31c83ef01693`.
- Phase 9 promotion commit: `b9345786727cbd2692447d1ce53d472d7670b3df`.
- The package version remains `0.5.0`; promotion does not imply package publication.

## Phase 9 Sovereign Products

Phase 9 exposes selected SIF capabilities to product-facing integrations through explicit, versioned adapters for `LARA_OS_REIE`, `QADRIX`, and `SOVEREIGN_LIBRARY`.

The boundary provides immutable-to-callers descriptors, deterministic request normalization and digests, fail-closed capability/authority/version/operation enforcement, explicit injected handlers, bounded adapter registration, append-only hash-linked product evidence, and deterministic request/response replay verification.

The adapter layer does not claim direct production integration, hidden network/database/browser/queue access, credential use, autonomous external actions, or automatic authority promotion. Product-specific work enters through explicit handlers only.

F9-001..F9-060 are executable in `packages/sif-core/test/sovereign-products.test.ts`.

## Verification boundary

SIF Core CI Run #530 verified the exact Phase 9 implementation HEAD with strict TypeScript build/tests, 470/470 package tests, 7/7 live PostgreSQL integration tests, federated inbox and PostgreSQL crash-window characterization, unpublished archive construction and integrity verification, exact-head artifact upload, and cleanup.

The exact-head candidate artifact was `sif-core-unpublished-candidate-e1a0b5d47caabd61016cad92b0bc31c83ef01693` with digest `sha256:d10d1b5885b99acef71343214daa2194e9327b073da41aad0a72add65f2ec56a`.

The Phase 9 implementation was then promoted into the preserved Phase 8 continuity line through merge commit `b9345786727cbd2692447d1ce53d472d7670b3df`.

Verification does not claim production deployment, external market forecasting, autonomous real-world action, distributed consensus, package publication, or a version bump.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

Phase 9 implementation, verification, and promotion are complete. A future phase is not defined by the current roadmap.

## License

Apache-2.0. See `LICENSE`.