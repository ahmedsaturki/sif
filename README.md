# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation begins with a small, verifiable TypeScript kernel and grows through evidence-gated integration layers.

## Current candidate line

- Verified kernel baseline is preserved.
- Phase 2 Live PostgreSQL verification remains preserved by later candidate CI.
- Phase 3 Secure Federation is an unpublished implementation candidate on its dedicated feature branch.
- Phase 4 Policy & Governance is an unpublished implementation candidate on `feat/sif-core-0.8.0-policy-governance`.
- The package version remains `0.5.0`; later milestones do not imply package publication.

## Phase 4 Policy & Governance

The Phase 4 candidate adds a dependency-free governance boundary for immutable policy versions, explicit lifecycle, timestamp-aware historical resolution, local deny-overrides/default-deny, provider-neutral OPA/Cedar-shaped adapters, deterministic attributable decision evidence, bounded policy/evaluation resources, and federated-policy subordination to local authorization.

The executable acceptance suite is F4-001..F4-040 in `packages/sif-core/test/policy-governance.test.ts`. Exact-head CI retains the existing persistence, crash-window, archive, and artifact verification gates.

## Verification boundary

A passing exact-head CI result is evidence for the exact source candidate only. It is not a production deployment, external policy-provider deployment, HA/performance claim, or registry publication claim.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

Promotion requires a separate explicit decision. No merge to `main`, version bump, or registry publication is implied by candidate verification.

## License

Apache-2.0. See `LICENSE`.
