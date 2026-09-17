# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation grows through evidence-gated, dependency-light kernel layers.

## Current promoted line

- Phase 2 Live PostgreSQL, Phase 3 Secure Federation, Phase 4 Policy & Governance, Phase 5 Evaluation & Observability, Phase 6 Knowledge / Semantic, Phase 7 Systemic / Ecological, Phase 8 Reflexive / Continuity, and Phase 9 Sovereign Products are preserved on dedicated branches.
- The cumulative Phase 7–9 tree is promoted into the preserved Phase 6 line `feat/sif-core-1.0.0-knowledge-semantic` at `77a605a936115815c2e833f6c4667f0e353aefbd`.
- Phase 9 exact implementation HEAD: `e1a0b5d47caabd61016cad92b0bc31c83ef01693`.
- Phase 9 promotion commit: `b9345786727cbd2692447d1ce53d472d7670b3df`.
- Phase 8 promotion commit: `963a268e205fb0d2b0dcaf0e184a25ab91befd73`.
- Final cumulative Phase 6-line promotion commit: `77a605a936115815c2e833f6c4667f0e353aefbd`.
- The package version remains `0.5.0`; promotion does not imply package publication.

## Phase 9 Sovereign Products

Phase 9 exposes selected SIF capabilities through explicit, versioned adapters for `LARA_OS_REIE`, `QADRIX`, and `SOVEREIGN_LIBRARY`.

The boundary provides immutable-to-callers descriptors, deterministic request normalization and digests, fail-closed capability/authority/version/operation enforcement, explicit injected handlers, bounded adapter registration, append-only hash-linked product evidence, and deterministic request/response replay verification.

The adapter layer does not claim direct production integration, hidden network/database/browser/queue access, credential use, autonomous external actions, or automatic authority promotion. Product-specific work enters through explicit handlers only.

F9-001..F9-060 are executable in `packages/sif-core/test/sovereign-products.test.ts`.

## Verification boundary

The final promoted Phase 6 line was reached only after exact-head verification of each cumulative promotion layer. The Phase 9 implementation passed Run #530; the Phase 8+9 cumulative line passed Run #35255909084; and the Phase 7+8+9 cumulative line passed Run #35256086808. The final cumulative promotion preserved the verified implementation tree.

The latest recorded cumulative artifact digest before promotion is `sha256:4270a743ca802944784f22a0beacec37b9589a8cc18c36b5dd6090ecdc2f7c63`.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

The current Phase 0–9 roadmap is closed. No Phase 10 is defined. No merge to `main`, package publication, release tag, production deployment, or direct external product integration is implied.

## License

Apache-2.0. See `LICENSE`.