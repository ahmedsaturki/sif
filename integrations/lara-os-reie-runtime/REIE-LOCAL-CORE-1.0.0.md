# REIE Local Core 1.0.0

## Status

Implemented on the branch-isolated SIF Adoption line.

## Product boundary

REIE is the local-first research/intelligence runtime. SIF is the governance and evidence boundary for operations that require explicit policy/capability/authority handling.

## Implemented

1. Deterministic normalization, canonicalization, and content hashing.
2. Append-only journal persistence with sequence + hash-chain verification.
3. Source/entity/claim provenance graph.
4. Canonical entity collision protection.
5. Deterministic knowledge lookup.
6. Entity-resolution candidate scoring with explicit match signals and no automatic merge.
7. Corroboration, completeness, freshness, and price-change signals.
8. Research-priority signal generation.
9. Bounded public-source text/JSON fetching without credentials.
10. Snapshot export and validated import.
11. Local CLI.
12. SIF policy/knowledge/evaluation/systemic/continuity invocation methods.
13. CI coverage across the frozen Core, Adoption Layer, and REIE runtime.

## Non-goals of Local Core

Browser automation, credentials, autonomous actions, paid providers, hidden network access, and automatic entity merging are intentionally outside this layer.

## Acceptance model

A feature is complete only when:

`IMPLEMENT -> TYPECHECK -> TEST -> CI -> REVIEWABLE BOUNDARY`

The runtime is not described as a production crawler or deployed service until an explicit deployment adapter exists and is separately verified.
