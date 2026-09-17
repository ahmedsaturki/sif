# Phase 6 Implementation Contract

1. Every ontology version is content-addressed by a deterministic SHA-256 digest.
2. Ontology versions use `x.y.z`; lifecycle transitions are explicit.
3. At most one non-retired ontology may resolve for a given identity and timestamp; activation rejects overlapping active windows.
4. Compatibility is provider-neutral and never treated as proof of semantic correctness beyond the declared boundary.
5. Epistemic state requires explicit status, bounded confidence, attributable sources, and normalized timestamps.
6. Provenance edges reference existing nodes and cannot introduce cycles.
7. Replay requires exact ontology identity plus epistemic/provenance identity and bounded descriptor size.
8. Legacy handoff never infers absent mappings; every source record is preserved by source digest and unmapped IDs are surfaced.
9. All public mutable inputs crossing a persistent boundary are cloned before retention.
10. Resource bounds are explicit and violations fail with typed errors.
