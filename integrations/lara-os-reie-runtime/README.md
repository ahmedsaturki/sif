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

## Future adapters

Browser workers, PostgreSQL persistence, model inference, entity extraction, and agent orchestration can be added above this core without changing the provenance and authority contracts.
