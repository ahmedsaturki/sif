# Phase 6 — Knowledge / Semantic Plane

## Objective
Establish a dependency-free semantic boundary that makes knowledge identity, compatibility, epistemic status, provenance, replay, and legacy handoff explicit and deterministic.

## Scope
- Versioned ontology definitions with immutable content digests and lifecycle.
- Timestamp-aware ontology resolution with overlap fail-closed behavior.
- Structural semantic compatibility classification across ontology versions.
- Explicit epistemic state: status, confidence, sources, observation time, and derivation lineage.
- Bounded provenance graph with deterministic snapshot identity and cycle prevention.
- Semantic replay descriptors bound to ontology, epistemic state, provenance, subject, and proposition.
- Legacy knowledge handoff that preserves source identity and records unmapped legacy data instead of silently inventing semantics.
- Deterministic semantic context hashing under explicit byte/resource limits.

## Non-goals
This phase does not claim an external ontology service, vector database, embedding model, knowledge graph product, autonomous semantic inference, or production deployment. No external network service is required.

## Fail-closed rules
A missing/ambiguous ontology, incompatible semantic version, replay mismatch, provenance cycle, invalid epistemic state, or resource-limit breach fails explicitly. Legacy records remain attributable and unmapped records are reported rather than guessed.
