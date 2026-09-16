# SIF Phase 4 — Policy & Governance Test Matrix

The required Phase 4 acceptance matrix is executable as `F4-001..F4-040` in `packages/sif-core/test/policy-governance.test.ts`.

## Coverage

- F4-001..F4-004: canonical digest, duplicate immutability, malformed policy rejection.
- F4-005..F4-009: explicit lifecycle, retirement, overlap detection, historical resolution, expiry.
- F4-010: request validation.
- F4-011..F4-014: local allow, deny, default-deny and deny-overrides.
- F4-015..F4-019: provider result normalization, attribution and fail-closed unavailable/incompatible/invalid outcomes.
- F4-020..F4-023: evidence identity and federated/local sovereignty boundaries.
- F4-024..F4-027: policy/rule/context/concurrency resource limits.
- F4-028..F4-031: deterministic replay, integrity tamper handling and provider scope boundary.
- F4-032..F4-037: missing/ambiguous policies, incompatible provider attribution, invalid outcomes, duplicate immutability and idempotent activation.
- F4-038..F4-040: historical decision continuity, immutable ledger evidence and federated local-policy enforcement.

## Pass condition

All required rows must pass on the exact candidate checkout in the repository SIF Core CI workflow. CI must also retain the repository-wide Phase 2/3 verification gates so a Phase 4 candidate cannot silently regress the verified persistence/federation substrate.

## Evidence boundary

A successful exact-head CI run verifies the candidate checkout and its executable tests. It does not imply package publication, production policy-provider deployment, or production federation/security claims.
