# SIF Repository 360° Baseline — Historical 0.5.0 Handoff

## Purpose

This file is a preserved historical handoff for the 0.5.0 baseline. It records what was in Git at that milestone, what was verified locally, what CI was responsible for proving, and what remained explicitly unverified. It is not the current SIF state record; `360_STATE.md` and the canonical cumulative branch are authoritative for current state.

## Canonical branches

- `main` — original Genesis baseline line at the time of this historical handoff.
- `feat/sif-core-0.5.0` — 0.5.0 preservation/release candidate line at the time of this historical handoff.
- Current cumulative preservation moved later to `feat/sif-core-1.0.0-knowledge-semantic`.

## Canonical release candidate

SIF Core `0.5.0` is preserved with its dependency-free TypeScript implementation, test suite, SQL schema, documentation, artifact inventory and source archive.

## Repository completeness target

At this historical milestone, the feature branch contained the tested source modules and tests in `packages/sif-core`, plus the preserved source archive under `artifacts/sif-core/0.5.0/`. Later phases were promoted onto the dedicated cumulative preservation line.

## Evidence layers

1. Local build/test evidence: TypeScript strict build and 27/27 tests passed in the development environment.
2. Repository evidence: source, tests, schema, README, implementation status, historical lineage and checksums are committed to the feature branch.
3. Historical CI evidence obligation: GitHub Actions had to independently verify archive integrity, decode the archive, extract the exact preserved tree, and execute `npm test`.
4. Historical live-infrastructure boundary: real PostgreSQL multi-client execution and production integrations remained separate gates.

## Preservation artifacts

- source ZIP SHA-256: `3f728ac799be5714efdbbddb80fae98152a3767f339f29ee84750ec1c2687bd5`
- npm package SHA-256: `c1b6d297ebef82523d4e1abc0249497fa702f3bd68bd6fa25d839402cc122abc`

The source ZIP is stored as base64 text in Git because the repository connector is text-safe; CI decodes it and checks the original ZIP digest.

## Explicit non-claims

The 0.5.0 baseline does not claim live PostgreSQL wire-level concurrency, SPIFFE/mTLS transport, OPA/Cedar integration, KMS/HSM integration, distributed consensus, production OpenTelemetry exporter behavior, or exactly-once external side effects.

## Continuity rule

Never silently replace historical evidence with a newer interpretation. Add new evidence, corrections and verification results as new repository state with lineage preserved.
