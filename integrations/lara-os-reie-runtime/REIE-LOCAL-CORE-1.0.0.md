# REIE Local Core 1.0.0

## Delivered scope

The local-first REIE core now has:

- append-only JSONL persistence with hash-chain integrity
- deterministic canonicalization and SHA-256 utilities
- explicit source/entity/claim provenance
- canonical entity collision protection
- entity resolution candidates with evidence-bearing match signals
- deterministic knowledge queries
- corroboration/confidence evaluation
- price history signals from observed claims
- missing-field and stale-source signals
- snapshot export/import with atomic snapshot replacement
- a zero-dependency Node CLI
- explicit SIF policy/knowledge/evaluation integration inherited from the SIF Adoption boundary

## Safety boundary

No automatic entity merge, no autonomous external action, no credential storage, no hidden network calls, and no paid AI dependency are part of Local Core 1.0.0.

## Future adapters

Browser/source connectors, PostgreSQL, agents, external model inference, and deployment adapters belong above this core and must preserve provenance, explicit authority, deterministic request identity, and human-review boundaries where applicable.
