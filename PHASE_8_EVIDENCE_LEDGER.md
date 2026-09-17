# Phase 8 — Evidence Ledger

## Candidate identity
The canonical Phase 8 candidate identity is the exact HEAD of `feat/sif-core-1.2.0-reflexive-continuity`. CI run numbers and artifact IDs are intentionally not written into this mutable ledger.

## Evidence classes

| Gate | Required evidence | Acceptance condition |
|---|---|---|
| SPEC | Phase 8 specification | invariants and non-goals explicitly defined |
| IMPLEMENT | dependency-free runtime | public API implements every contract item |
| TEST | F8-001..F8-060 | executable coverage present in package test suite |
| FIX | CI-driven defects | every failure corrected before candidate verification |
| VERIFY | exact-head SIF Core CI | checkout, strict build/tests, PostgreSQL, crash windows, archive and artifact gates all pass for the same HEAD |
| PRESERVE | archive manifest + digest | snapshot, lineage and file identities are reproducible |
| PROMOTION | explicit human action | no automatic publication or main merge |

## Continuity claims
The phase may claim deterministic identity, bounded lineage, fail-closed self-model verification, proposal/review based self-improvement, explicit succession, verifiable reconstruction, and preservation metadata only when the exact candidate and its CI evidence agree.

## Not claimed
This phase does not claim autonomous self-modification, automatic promotion, external deployment, network or shell control, cryptographic key custody, distributed succession consensus, perfect reconstruction after arbitrary data loss, or that a self-model is intrinsically true.

## Provenance rule
A mutable state document must describe the architecture and verification boundary without embedding dynamic run IDs, artifact IDs, or hashes that would change when the document itself changes. The exact-head CI record and uploaded candidate artifact are the authoritative runtime evidence.
