# Lara OS / REIE Runtime 1.0.0

Local-first Real Estate Intelligence & Entity research runtime with an explicit SIF governance boundary.

## Delivered capability

- append-only JSONL persistence with hash-chain verification
- deterministic canonical JSON and SHA-256 identity utilities
- source registration with provenance/content digests
- canonical entity upsert and collision protection
- claim recording with source references
- deterministic knowledge queries
- evidence-bearing entity resolution candidates; no automatic merge
- corroboration, missing-field, freshness, and observed price-change signals
- research-priority signal generation
- optional public HTTP(S) text/JSON source fetch with size and timeout limits
- snapshot export and validated import
- zero-dependency Node CLI
- deterministic ingestion for explicit JSON records and explicitly mapped CSV rows
- source-only preservation for plain text without semantic guessing
- evidence-derived opportunity projection for research prioritization
- SIF policy, knowledge, evaluation, systemic, and continuity invocation boundaries

## Architecture

```text
Local / public source adapter
          |
          v
    REIE Local Core
          |
     provenance +
 deterministic state
          |
          v
    SIF Adoption Layer
          |
          v
       SIF Core
```

SIF remains the authority boundary for governed operations. REIE does not silently obtain credentials, broaden authority, merge entities automatically, or perform external side effects.

## CLI

After building:

```sh
./packages/sif-core/node_modules/.bin/tsc -p integrations/lara-os-reie-runtime/tsconfig.json
node integrations/lara-os-reie-runtime/dist/cli.js init ./reie-data/events.jsonl
node integrations/lara-os-reie-runtime/dist/cli.js demo ./reie-data/events.jsonl
node integrations/lara-os-reie-runtime/dist/cli.js health ./reie-data/events.jsonl
node integrations/lara-os-reie-runtime/dist/cli.js query ./reie-data/events.jsonl "Galaxy Sadat"
node integrations/lara-os-reie-runtime/dist/cli.js evaluate ./reie-data/events.jsonl demo-property-1
node integrations/lara-os-reie-runtime/dist/cli.js signals ./reie-data/events.jsonl demo-property-1
```

## Data model

`Source -> Entity -> Claim -> Evidence-derived signal`

A claim always references an entity and a registered source. Source content identity is represented by a SHA-256 digest.

## Safety and boundaries

The Local Core does not include browser automation, credential storage, paid AI APIs, autonomous external actions, or automatic entity merging.

The public fetch adapter accepts only HTTP(S) URLs and textual responses, uses bounded reads/timeouts, sends no credentials, and does not expose a crawler.

## Ingestion

The ingestion adapter accepts explicit JSON records or CSV rows with a required column mapping. It computes a content digest, registers the source, creates deterministic entity/claim identifiers, and rejects ambiguous or invalid records rather than guessing.

Plain-text sources are preserved as sources but are intentionally not converted into entities or claims by string heuristics. Semantic extraction belongs in a separately governed adapter.

Example JSON shape:

```json
{
  "records": [
    {
      "entityId": "p1",
      "entityType": "property",
      "canonicalName": "Galaxy Mall",
      "location": "Sadat City",
      "claims": [
        { "field": "propertyType", "value": "mall" },
        { "field": "price.amount", "value": 2500000 }
      ]
    }
  ]
}
```

Workspace entry points are `ingestDocument(...)` and `opportunities(...)`. Opportunity output is evidence-derived and deterministic; it does not make external decisions or perform outreach.

## Future adapters

Browser workers, PostgreSQL persistence, model inference, semantic entity extraction, and agent orchestration can be added above this layer without changing the provenance and authority contracts.
