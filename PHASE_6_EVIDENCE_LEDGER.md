# Phase 6 Evidence Ledger

This ledger records the evidence boundary for the Knowledge / Semantic Plane candidate. Dynamic workflow and artifact identifiers are intentionally omitted to avoid self-referential provenance.

## Candidate Scope
- Versioned ontology with deterministic digest and lifecycle.
- Temporal ontology resolution and overlap rejection.
- Provider-neutral semantic compatibility classification.
- Explicit epistemic state and attributable sources.
- Bounded acyclic provenance graph.
- Semantic replay binding.
- Legacy knowledge handoff with explicit unmapped reporting.
- Bounded semantic context hashing.

## Required Verification
1. Exact candidate checkout.
2. Strict TypeScript build and executable acceptance tests F6-001..F6-060.
3. Existing PostgreSQL integration regression suite.
4. Existing federated inbox and PostgreSQL crash-window characterization.
5. Candidate archive build and verification.
6. Unpublished artifact upload with digest bound to the exact candidate HEAD.

## Release Boundary
No package version bump, registry publication, merge to `main`, production semantic infrastructure claim, external ontology service dependency, or automatic promotion is implied.

## Verified Evidence State
All required Phase 6 verification gates passed on the same candidate HEAD in the authoritative exact-head SIF Core CI workflow:

- Exact candidate checkout: PASS.
- Strict TypeScript build and executable F6-001..F6-060 acceptance suite: PASS.
- Existing PostgreSQL integration regression suite: PASS.
- Federated inbox crash-window characterization: PASS.
- PostgreSQL crash-window characterization: PASS.
- Candidate archive build: PASS.
- Candidate archive verification: PASS.
- Unpublished candidate artifact upload: PASS.

The authoritative candidate identity remains the branch HEAD. The successful workflow's artifact digest is bound to that exact checkout. Dynamic run numbers, run IDs, artifact IDs, and artifact digests are intentionally not copied into this mutable ledger.

## Current Status
Phase 6 verification is complete for the current candidate. Release, merge, publication, production deployment claims, and automatic promotion remain separate explicit boundaries.
