# SIF Repository 360° Baseline

## Purpose

This file is the repository-level handoff record: what is in Git, what is verified locally, what CI is responsible for proving, and what remains explicitly unverified.

## Canonical branches

- `main` — original baseline line; deliberately kept separate from the 0.5.0 preservation work until its verification gates are satisfied.
- `feat/sif-core-0.5.0` — current preservation/release candidate line.

## Canonical release candidate

SIF Core `0.5.0` is preserved with its dependency-free TypeScript implementation, test suite, SQL schema, documentation, artifact inventory and source archive.

## Repository completeness target

The feature branch contains the tested source modules and tests in `packages/sif-core`, plus the preserved source archive under `artifacts/sif-core/0.5.0/`.

## Evidence layers

1. Local build/test evidence: TypeScript strict build and 27/27 tests passed in the development environment.
2. Repository evidence: source, tests, schema, README, implementation status, historical lineage and checksums are committed to the feature branch.
3. CI evidence: GitHub Actions must independently verify archive integrity, decode the archive, extract the exact preserved tree, and execute `npm test`.
4. Live infrastructure evidence: real PostgreSQL multi-client execution and production integrations remain separate gates.

## Preservation artifacts

- source ZIP SHA-256: `3f728ac799be5714efdbbddb80fae98152a3767f339f29ee84750ec1c2687bd5`
- npm package SHA-256: `c1b6d297ebef82523d4e1abc0249497fa702f3bd68bd6fa25d839402cc122abc`

The source ZIP is stored as base64 text in Git because the repository connector is text-safe; CI decodes it and checks the original ZIP digest.

## Explicit non-claims

The 0.5.0 baseline does not claim live PostgreSQL wire-level concurrency, SPIFFE/mTLS transport, OPA/Cedar integration, KMS/HSM integration, distributed consensus, production OpenTelemetry exporter behavior, or exactly-once external side effects.

## Continuity rule

Never silently replace historical evidence with a newer interpretation. Add new evidence, corrections and verification results as new repository state with lineage preserved.
