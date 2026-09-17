# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation begins with a small, verifiable TypeScript kernel and grows through evidence-gated integration layers.

## Current candidate line

- Verified kernel baseline is preserved.
- Phase 2 Live PostgreSQL verification remains preserved by later candidate CI.
- Phase 3 Secure Federation remains a preserved unpublished implementation candidate on its dedicated feature branch.
- Phase 4 Policy & Governance remains a preserved unpublished implementation candidate on its dedicated feature branch.
- Phase 5 Evaluation & Observability remains a preserved unpublished implementation candidate on `feat/sif-core-0.9.0-evaluation-observability`.
- Phase 6 Knowledge / Semantic Plane is the current unpublished implementation candidate on `feat/sif-core-1.0.0-knowledge-semantic-plane`.
- The package version remains `0.5.0`; later milestones do not imply package publication.

## Phase 6 Knowledge / Semantic Plane

The Phase 6 candidate adds a dependency-free semantic boundary for deterministic ontology identity and lifecycle, timestamp-aware ontology resolution with overlap rejection, provider-neutral semantic compatibility, explicit epistemic state, bounded acyclic provenance, semantic replay binding, deterministic semantic-context hashing, and legacy knowledge handoff that preserves source identity while surfacing unmapped records.

The executable acceptance suite is F6-001..F6-060 in `packages/sif-core/test/knowledge-semantic-acceptance.test.ts`. Exact-head CI retains the existing PostgreSQL, crash-window, archive, and artifact verification gates.

## Verification boundary

The current Phase 6 branch candidate has passed exact-head SIF Core CI on the same commit as the branch HEAD. The successful run verified checkout identity, strict build/tests, live PostgreSQL integration, both crash-window characterizations, candidate archive construction/verification, unpublished artifact upload, and cleanup. The uploaded artifact digest is bound to that exact candidate checkout.

A passing exact-head CI result is evidence for the exact source candidate only. It is not a production deployment, external ontology-service deployment, HA/performance claim, semantic correctness proof beyond the tested boundary, or registry publication claim.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

Promotion requires a separate explicit decision. No merge to `main`, version bump, registry publication, or automatic promotion is implied by candidate verification.

## License

Apache-2.0. See `LICENSE`.
