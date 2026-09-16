# SIF Phase 6 — Knowledge / Semantic Plane Implementation Contract

## Runtime boundaries

- Reuse existing `EvidenceRegistry`, `KnowledgeRegistry`, and `SemanticRegistry` semantics where compatible; do not create a second competing authority model.
- Add a higher-level immutable/versioned plane around those primitives.
- Ontology versions are immutable content-addressed identities with explicit `DRAFT → ACTIVE → RETIRED` lifecycle.
- Semantic concepts are unique within `(namespace, conceptId, version)` and cannot be silently overwritten.
- Mappings are explicit, provenance-bearing, confidence-bounded, and version-bound.
- Compatibility resolution returns only deterministic `EXACT`, `COMPATIBLE`, `INCOMPATIBLE`, or `INDETERMINATE`; unresolved/ambiguous mappings never become compatible by default.
- Knowledge assertions are immutable records. Supersession and retraction are represented as new records, preserving prior history.
- Temporal queries honor `validFrom`/`validUntil` and report contradictions rather than silently selecting a winner.
- Provenance nodes are append-only, parent-linked, cycle-protected, and bounded for traversal.
- Semantic replay consumes append-only operations and verifies the resulting digest against an exact ontology version.
- Legacy handoff is explicit: original IDs, source, provenance, semantic version, and epistemic status are preserved; handoff never grants or widens authority.
- Remote/federated knowledge remains attributed as remote evidence until a separate local admission process accepts it.
- All public operations are bounded by configurable node, mapping, knowledge, payload, and traversal limits.

## Proposed public runtime

`knowledge-semantic.ts` should expose:

- ontology lifecycle/version registry and deterministic ontology digest;
- concept/mapping registration with immutable identity;
- compatibility resolution with fail-closed ambiguity;
- epistemic knowledge assertion store with temporal/contradiction/supersession queries;
- provenance graph with bounded ancestry traversal;
- append-only semantic operation log and deterministic semantic replay;
- legacy handoff adapter and result record;
- typed error taxonomy and explicit limits.

## Verification requirements

F6-001..F6-060 must be executable and cover deterministic identity, immutability, lifecycle, compatibility, epistemic qualification, temporal behavior, contradiction handling, provenance, replay, handoff, resource bounds, and cross-phase authority isolation.

A passed test must demonstrate the claimed property rather than only instantiate the relevant class.

## Release boundary

No package version bump, registry publication, merge to `main`, production knowledge graph, distributed semantic store, or automatic truth/authority promotion is implied.
