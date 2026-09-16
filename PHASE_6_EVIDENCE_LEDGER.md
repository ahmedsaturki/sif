# SIF Phase 6 — Knowledge / Semantic Plane Evidence Ledger

Every required row maps to an executable test in `packages/sif-core/test/knowledge-semantic-acceptance.test.ts`.

| Rows | Proof boundary |
|---|---|
| F6-001..F6-015 | ontology identity, immutability, lifecycle, validation, bounds |
| F6-016..F6-030 | exact/compatible/incompatible/indeterminate semantic compatibility and deterministic decisions |
| F6-031..F6-042 | epistemic qualification, temporal validity, contradictions, supersession/retraction, remote attribution |
| F6-043..F6-050 | provenance immutability, parent integrity, cycle protection, bounded ancestry, graph identity |
| F6-051..F6-056 | append-only semantic operations, deterministic replay, version filtering, replay mismatch, resource bounds |
| F6-057..F6-060 | provenance-preserving legacy handoff and authority non-widening boundary |

## Exact-head rule

A row is considered verified only when the exact candidate checkout passes the full SIF Core CI workflow, including strict build/tests, live PostgreSQL integration, both crash-window characterizations, candidate archive build/verification, and artifact upload.

## Provenance boundary

Candidate identity is the branch HEAD checked out by CI. The uploaded unpublished candidate artifact from the same successful exact-head run is the artifact identity for that candidate. Dynamic run/artifact identifiers are not committed into mutable state documents.
