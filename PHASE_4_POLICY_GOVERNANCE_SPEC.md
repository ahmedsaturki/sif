# SIF Phase 4 — Secure Policy & Governance Specification

## Status
IMPLEMENTED CANDIDATE — the Phase 4 runtime boundary and executable F4-001..F4-040 acceptance suite are present on the dedicated candidate branch. Promotion remains separate from implementation verification.

## Objective
Provide a sovereignty-preserving policy/governance boundary above the verified SIF kernel and federation substrate. Local authorization remains authoritative; remote policy assertions and trust metadata are evidence/inputs only.

## Required properties

- immutable policy content and version identity;
- explicit policy lifecycle and timestamp-aware historical resolution;
- deterministic local evaluation with deny-overrides and default-deny;
- provider-neutral OPA/Cedar-shaped adapter boundary;
- exact policy/request attribution for decisions;
- explicit `INDETERMINATE` handling for unavailable/incompatible/invalid providers;
- bounded policy, context, version and concurrent-evaluation resources;
- federated policy inputs subordinate to local authorization;
- no implicit conversion of remote trust into local authority.

## Verification boundary

The executable acceptance suite is `F4-001..F4-040` in `packages/sif-core/test/policy-governance.test.ts`.

The repository CI gate must verify the exact candidate checkout, strict build/tests, live PostgreSQL integration, crash-window characterization, candidate archive construction/verification, and artifact upload.

## Non-goals

- no package publication;
- no merge to `main`;
- no production OPA/Cedar deployment claim;
- no KMS/HSM integration claim;
- no production HA/performance claim.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

Verification evidence must remain exact to the candidate commit and must not be self-invalidating by embedding dynamic CI run or artifact identifiers.
