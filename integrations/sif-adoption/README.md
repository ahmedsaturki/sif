# SIF Adoption Layer 1.0.0

The SIF Adoption Layer is the application-facing boundary around the frozen `sif-core@0.5.0` product adapter surface.

It is intentionally **not** part of the frozen canonical SIF Core line. This directory is a separate branch-owned integration layer that can evolve without changing the Core contract.

## What it provides

- a versioned integration envelope (`1.0`)
- deterministic envelope hashing
- fail-closed routing through the existing SIF product adapter registry
- explicit support for `LARA_OS_REIE`, `QADRIX`, and `SOVEREIGN_LIBRARY`
- append-only product evidence recording
- deterministic replay verification for valid Core responses
- request-level idempotency with conflict detection
- bounded processed-request memory
- zero network, database, credential, browser, queue, or process-spawning behavior

## Execution model

`external application -> integration envelope -> SIF product registry -> explicit injected handler -> Core response -> evidence -> replay check`

The integration layer does not invent authority. The existing Core product descriptors and capability/authority gates remain the enforcement boundary.

## Build and verify

From the repository root:

```sh
cd packages/sif-core
npm ci
npm test
cd ../..
./packages/sif-core/node_modules/.bin/tsc -p integrations/sif-adoption/tsconfig.json
node --test integrations/sif-adoption/dist/test/*.test.js
```

The GitHub workflow repeats the Core verification first, then verifies the adoption layer against the exact candidate commit.

## Deliberate non-claims

This layer is an adoption boundary, not a production integration deployment. It does not claim direct connectivity to Lara OS/REIE, QADRIX, or Sovereign Library, and it does not perform autonomous external actions.
