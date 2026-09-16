# SIF Phase 6 — Knowledge / Semantic Plane Test Matrix

Required executable acceptance rows: **F6-001..F6-060**.

- **F6-001..F6-015 — Ontology/versioning:** deterministic ontology identity, concept uniqueness, immutable versions, lifecycle transitions, deprecation, invalid timestamps, duplicate conflict detection, bounded concept/mapping counts and payloads.
- **F6-016..F6-030 — Semantic compatibility:** exact-version matches, explicit equivalent/broader/narrower/related/approximate/conditional mappings, confidence bounds, ambiguous mappings, missing mappings, incompatible relations, deterministic decisions, and version isolation.
- **F6-031..F6-042 — Epistemic knowledge:** evidence/provenance qualification, deterministic knowledge identity, immutable records, temporal validity, supersession/retraction as new records, contradiction detection, scoped queries, and remote-evidence attribution.
- **F6-043..F6-050 — Provenance graph:** immutable nodes, parent validation, cycle rejection, bounded ancestry traversal, deterministic graph identity, and missing-parent handling.
- **F6-051..F6-056 — Semantic replay:** append-only semantic operations, deterministic reconstruction, exact ontology binding, digest mismatch rejection, replay resource bounds, and history preservation.
- **F6-057..F6-060 — Legacy handoff/cross-phase safety:** provenance-preserving legacy import, semantic version binding, authority non-widening, and complete cross-phase evidence qualification.

## Pass condition
All 60 rows must execute and pass against the exact candidate checkout. Documentary presence is not proof.

## Evidence boundary
Successful Phase 6 CI proves only the exact source checkout and its unpublished artifact. It does not imply a production semantic database, external knowledge graph, or automatic truth/authority promotion.
