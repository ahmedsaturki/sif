# SIF Phase 6 — Knowledge / Semantic Plane Specification

## Status
SPEC ONLY — the Phase 6 runtime remains unpromoted until its executable matrix and exact-head verification pass.

## Objective
Harden the existing knowledge and semantic primitives into a sovereign, versioned plane that preserves meaning across time without rewriting authoritative history.

## Required areas

1. **Versioned ontology** — immutable ontology versions with deterministic digests, explicit lifecycle, concept identity, deprecation, and bounded size.
2. **Semantic compatibility** — deterministic compatibility decisions across ontology versions using explicit mappings, confidence, relation semantics, and fail-closed ambiguity handling.
3. **Epistemic state** — evidence-qualified knowledge assertions with temporal validity, contradiction awareness, supersession/retraction as new facts, and deterministic identity.
4. **Provenance graph** — immutable provenance nodes/edges with ancestry traversal, cycle rejection, temporal metadata, and bounded traversal.
5. **Semantic replay** — deterministic reconstruction of ontology/knowledge derived state from append-only semantic operations, bound to exact semantic version identity.
6. **Legacy knowledge handoff** — explicit import/adoption boundary for legacy knowledge and semantic records that preserves original identity/provenance and cannot widen authority.
7. **Cross-phase qualification** — knowledge/semantic evidence integrates with the existing evidence, policy, federation, and evaluation boundaries without becoming authorization by implication.

## Non-goals

- no mutable rewrite of prior knowledge or semantic history;
- no automatic truth determination from confidence alone;
- no authority grant from knowledge provenance, semantic compatibility, or remote evidence;
- no hidden ontology translation when compatibility is ambiguous;
- no external graph database dependency in the dependency-free kernel;
- no production knowledge graph deployment claim.

## Security and sovereignty invariants

- historical meaning remains addressable by exact ontology version;
- immutable identity prevents silent replacement of semantic records;
- compatibility is explicit and fail-closed when unresolved or ambiguous;
- epistemic status remains attributable to evidence/provenance and does not become authority;
- remote/federated knowledge is marked as remote evidence until locally admitted;
- legacy handoff is provenance-preserving and capability-neutral;
- replay is deterministic and candidate/version bound;
- all registries and traversals are resource-bounded.

## Verification boundary

Phase 6 is not promotable until F6-001..F6-060 execute against the exact candidate checkout and the artifact provenance is bound to that same checkout.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
