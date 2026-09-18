# Lara OS / REIE Runtime

Local-first, dependency-free foundation for Real Estate Intelligence & Entity research.

## Scope

The runtime currently provides deterministic local primitives for:

- source registration with content digests
- canonical entity upsert and collision detection
- claim storage with source provenance
- deterministic knowledge queries
- deterministic corroboration/confidence evaluation
- an explicit SIF invocation boundary for policy, knowledge, and evaluation operations

It does not scrape websites, automate browsers, store credentials, call paid AI APIs, or perform external side effects.

## Architecture

```text
Local source/entity/claim data
            |
            v
      REIE Runtime
            |
            v
     explicit SIF bridge
            |
            v
       SIF Adoption
            |
            v
         SIF Core
```

The runtime is intentionally useful without SIF for local research, while SIF remains the authority boundary when governed operations are requested.

## Build

The only build-time tool is the TypeScript compiler already provided by the SIF Core workspace.

```sh
./packages/sif-core/node_modules/.bin/tsc -p integrations/lara-os-reie-runtime/tsconfig.json
node --test integrations/lara-os-reie-runtime/dist/test/*.test.js
```

## Next expansion

Future adapters can add browser/source ingestion, PostgreSQL persistence, entity extraction, deduplication, price history, opportunity detection, and agent workers without changing the local core contract.
