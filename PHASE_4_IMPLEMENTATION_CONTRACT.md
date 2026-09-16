# SIF Phase 4 — Policy & Governance Implementation Contract

## Purpose
Implement a dependency-free policy and governance boundary over the verified SIF kernel and Phase 3 federation substrate.

## Required invariants

1. Policy versions are immutable by `(policyId, version, digest)`.
2. New versions enter `registered`, then explicit `active`, then optional `retired`.
3. At a decision timestamp, resolution is deterministic; overlapping active versions fail closed.
4. Historical decisions remain attributable to the exact policy version and digest that was resolved at that timestamp.
5. Local policy is sovereign: explicit local deny overrides allow, no local allow yields default deny, and remote policy assertions cannot create local authority.
6. Provider adapters are provider-neutral and their results must bind to the resolved policy identity and digest.
7. Provider unavailable/incompatible/invalid outcomes never become implicit allow.
8. Decision evidence carries policy identity, request identity, provider attribution, decision time, and failure context when relevant.
9. Resource limits are enforced before expensive provider work where feasible.
10. Federated policy context is metadata only; it cannot widen local authorization.
11. The kernel remains dependency-free and host integrations remain adapter boundaries.
12. No package publication, main-branch merge, or production deployment claim is part of Phase 4 verification.

## Required runtime areas

- policy bundle canonicalization and SHA-256 digest
- immutable version registry
- lifecycle and historical timestamp resolution
- deterministic local rule evaluation
- provider-neutral OPA/Cedar-shaped adapter boundary
- fail-closed provider-result validation
- decision evidence/ledger
- resource and concurrency bounds
- federation-to-policy admission boundary

## Verification

`packages/sif-core/test/policy-governance.test.ts` contains the F4-001..F4-040 executable acceptance matrix.

Verification must use the exact candidate checkout and the repository CI gate, including strict build/tests, live PostgreSQL integration, crash-window characterization, archive verification, and artifact upload.

## Release boundary

Phase 4 remains unpublished until a separate promotion decision. The package version stays `0.5.0`.
