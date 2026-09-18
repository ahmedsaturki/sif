# REIE Governed Host 2.1.0 Release / Freeze Record

## Promoted line

- Branch: `feat/sif-adoption-layer-1.0.0`
- Release: REIE Governed Host 2.1.0
- Merge PR: #35
- Merge commit: `809d602542f26df38333fafded3e14227bca183d`
- Base application release: REIE Operational Platform 2.0.0
- Frozen SIF Core contract: `sif-core@0.5.0`

## Included

- executable REIE host composition
- real SIF Adoption Gateway governance path for REIE agents
- explicit allowlisted agent policy gate
- public-source browser capture pipeline
- persistent raw source artifacts with digest verification and conflict protection
- API exposure of raw source evidence
- `serve` and `collect` host CLI commands
- accurate REIE API client error status mapping
- idempotent and conflict-safe operational journal writes
- regression coverage for governance, provenance, host composition, and HTTP behavior

## Verification

The exact PR #35 candidate passed:
- SIF Core CI
- SIF Adoption Layer CI
- REIE Local Core CI
- REIE Operational Platform CI
- REIE PostgreSQL Adapter CI
- REIE Governed Host CI

The merged state subsequently passed:
- SIF Adoption Layer CI on `809d602...`
- SIF Core CI #816 on `809d602...`

## Freeze boundary

No SIF Core source or package version changed.

No Phase 10 is defined.

Browser collection remains collection-only and does not inject credentials, automate login, submit forms, perform outreach, or merge entities automatically.

Semantic extraction remains candidate-first and human-reviewed.

PostgreSQL and browser dependencies remain optional boundary packages; the REIE local runtime remains dependency-light.

## Release discipline

Future changes must use a new specification and isolated branch. The frozen Core contract is not changed implicitly by application-layer work.
