# Phase 6 Test Matrix

| Group | Cases | Gate |
|---|---:|---|
| Ontology identity and validation | F6-001..F6-010 | deterministic identity, syntax, bounds, clone safety |
| Registry lifecycle and temporal resolution | F6-011..F6-020 | registration, activation, retirement, overlap fail-closed, historical resolution |
| Semantic compatibility | F6-021..F6-025 | exact, forward-compatible, major mismatch, older-target uncertainty, identity mismatch |
| Epistemic state | F6-026..F6-032 | deterministic state, confidence/source bounds, provenance lineage, immutability |
| Provenance graph | F6-033..F6-040 | nodes, edges, references, DAG, limits, deterministic snapshot |
| Semantic replay | F6-041..F6-046 | exact replay, ontology/epistemic/provenance mismatch, descriptor bounds |
| Legacy handoff | F6-047..F6-053 | mapped/unmapped behavior, unknown mappings, bounds, deterministic evidence |
| Context and final integration | F6-054..F6-060 | bounded hashing, semantic records, replay integration |

Acceptance requires every executable case to pass in the committed tree. Documentary descriptions are not proof by themselves.
