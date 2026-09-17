# Phase 7 — Evidence Ledger

## Candidate

Branch: `feat/sif-core-1.1.0-systemic-ecological-plane`

The candidate begins from the exact verified Phase 6 candidate HEAD. The authoritative candidate identity is always the branch HEAD.

## Evidence requirements

The phase ledger must demonstrate:

- strict TypeScript build and F7-001..F7-060 acceptance coverage;
- exact candidate checkout;
- live PostgreSQL integration regression preservation;
- federated inbox crash-window characterization;
- PostgreSQL crash-window characterization;
- candidate archive build and verification;
- unpublished artifact upload;
- cleanup completion.

Dynamic CI run numbers, run IDs, artifact IDs, and artifact digests are not committed into mutable state files, preventing self-referential provenance.

## Current status

Implementation candidate only until the exact-head verification gates pass on the same branch HEAD.

## Release boundary

No package version bump, registry publication, merge to `main`, production systemic simulation deployment, autonomous agent execution, real-world market action, or automatic promotion is implied.
