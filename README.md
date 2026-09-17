# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation grows through evidence-gated, dependency-light kernel layers.

## Current candidate line

- The verified kernel baseline and preserved candidate phases remain available on their dedicated lines.
- Phase 2 Live PostgreSQL, Phase 3 Secure Federation, Phase 4 Policy & Governance, Phase 5 Evaluation & Observability, Phase 6 Knowledge / Semantic, Phase 7 Systemic / Ecological, and Phase 8 Reflexive / Continuity are preserved as verified implementation candidates.
- Phase 9 Sovereign Products is the current unpublished implementation candidate on `feat/sif-core-1.3.0-sovereign-products`.
- Phase 9 implementation anchor: `fdb2a2e542f1745612e0617668258550bba5b12f`.
- The package version remains `0.5.0`; candidate phases do not imply publication.

## Phase 9 Sovereign Products

Phase 9 exposes selected SIF capabilities to product-facing integrations through explicit, versioned adapters for `LARA_OS_REIE`, `QADRIX`, and `SOVEREIGN_LIBRARY`.

The boundary provides immutable-to-callers descriptors, deterministic request normalization and digests, fail-closed capability/authority/version/operation enforcement, explicit injected handlers, bounded adapter registration, append-only hash-linked product evidence, and deterministic request/response replay verification.

The adapter layer does not claim direct production integration, hidden network/database/browser/queue access, credential use, autonomous external actions, or automatic authority promotion. Product-specific work enters through explicit handlers only.

F9-001..F9-060 are executable in `packages/sif-core/test/sovereign-products.test.ts`.

## Verification boundary

A successful exact-head SIF Core CI run verifies the exact source checkout and its unpublished candidate artifact. The Phase 9 implementation anchor passed strict TypeScript build/tests, live PostgreSQL integration, federated inbox and PostgreSQL crash-window characterization, unpublished archive construction/verification, artifact upload, and cleanup.

The repository release discipline requires a fresh exact-head verification whenever the candidate HEAD changes, including documentation-only reconciliation commits.

Verification does not claim production deployment, external market forecasting, autonomous real-world action, distributed consensus, package publication, or a version bump.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

Promotion requires a separate explicit decision. No merge to `main`, version bump, or registry publication is implied by candidate verification.

## License

Apache-2.0. See `LICENSE`.
