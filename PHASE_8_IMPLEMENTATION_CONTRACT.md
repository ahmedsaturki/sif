# Phase 8 — Implementation Contract

## Public boundary
The implementation lives in `packages/sif-core/src/reflexive-continuity.ts` and is re-exported from `src/index.ts`.

## Required behavior
- `selfModelDigest` and `createContinuitySnapshot` produce deterministic identities from canonical content.
- `verifySelfModelContinuity` rejects verifier disagreement.
- `buildContinuityLineage` validates references and detects cycles with bounded ancestry.
- `createSelfImprovementProposal` binds every proposal to an exact base snapshot and rejects authority widening.
- `reviewSelfImprovementProposal` requires every declared evaluation to be present, bound to the proposal, and `PASS` before approval.
- `prepareImprovementCandidate` requires an approved review against the exact base snapshot and creates a derived generation without external effects.
- `createSuccessionCertificate` and `verifySuccessionCertificate` require distinct identities, one-step generation succession, provenance evidence, and non-widening scopes.
- `createPreservationManifest` and `verifyPreservationManifest` provide deterministic archive identity and file-level integrity metadata.
- `reconstructContinuity` returns explicit mismatch evidence rather than silently correcting state.
- `createContinuityArchive` and `verifyContinuityArchive` bind snapshot, lineage, and preservation identities.
- `ReflexiveContinuityStore` is bounded and returns cloned records.

## Security / authority boundary
Authority scope comparison is set inclusion. The implementation permits preservation or narrowing only. There is no code path that grants a new scope, invokes an external system, changes credentials, or promotes a candidate.

## Determinism
All semantic identities use the existing SIF `digest` and `stableStringify` primitives. Inputs are cloned before storage or return where mutability could otherwise create aliasing.

## Resource controls
Limits cover lineage nodes, parents, ancestry, evidence, artifacts, event-stream heads, state, archive files, change sets, proposal size/count, and succession certificate count. Invalid or excessive input fails closed.
