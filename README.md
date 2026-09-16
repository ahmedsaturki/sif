# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation begins with a small, verifiable TypeScript kernel and grows through evidence-gated integration layers.

## Repository baseline

The `feat/sif-core-0.5.0` branch preserves the SIF Core 0.5.0 implementation, source/test tree, engineering history, research lineage, verification boundaries, and release discipline.

## SIF Core 0.5.0

The verified kernel includes append-only event streams, deterministic replay, optimistic concurrency, SHA-256 event integrity and stream hash chains, filesystem CAS, evidence/provenance/knowledge/semantic/lineage registries, scoped authority and attenuation, default-deny policy, durable outbox delivery, PostgreSQL transactional contracts, Ed25519 attestations, worker/inbox primitives, resumable projections, and self-model/reconstruction verification.

## Verification

Local verification:

```text
TypeScript build: PASS
Tests: 27/27 PASS
Failed: 0
Skipped: 0
```

Repository CI verifies the committed artifact identity records and directly builds/tests the committed `packages/sif-core` tree on GitHub Actions.

## Continuity and preserved knowledge

- `PROJECT_HISTORY.md` — 0.0.0 → current implementation lineage
- `360_STATE.md` — repository/system state, laws, unknowns and gates
- `IMPLEMENTATION_LOG.md` — implementation stages and critical fixes
- `RESEARCH_SYNTHESIS.md` — reusable engineering patterns and research synthesis
- `ROADMAP.md` — evidence-gated next stages
- `DECISIONS.md` — important architecture and engineering decisions
- `VERIFICATION_MATRIX.md` — capability-by-capability evidence state
- `RELEASE_NOTES_0.5.0.md` — release scope and boundaries
- `REPOSITORY_360_BASELINE.md` — repository preservation baseline
- `packages/sif-core/docs/ARCHITECTURE.md` — kernel architecture
- `packages/sif-core/IMPLEMENTATION_STATUS.md` — implementation and verification status
- `artifacts/sif-core/0.5.0/ARTIFACT_INVENTORY.md` — artifact identity
- `artifacts/sif-core/0.5.0/SHA256SUMS` — binary artifact identity hashes
- `artifacts/sif-core/0.5.0/ARCHIVE_PRESERVATION.md` — byte-for-byte artifact preservation record

## Binary artifact preservation

The byte-for-byte SIF Core 0.5.0 source ZIP and npm TGZ are preserved in the persistent Library. Their SHA-256 identities are recorded in `artifacts/sif-core/0.5.0/SHA256SUMS`. GitHub publication of binary release assets is intentionally a later release step; the repository never pretends an incomplete binary upload is a verified artifact.

## Verification boundary

0.5.0 does not claim live PostgreSQL wire-level multi-client verification, SPIFFE/mTLS transport, OPA/Cedar adapters, KMS/HSM integration, distributed consensus, production OpenTelemetry exporters, or exactly-once external side effects. These remain explicit integration boundaries.

## Release discipline

```text
SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT
```

No capability is considered complete because code exists. Promotion requires reproducible evidence, explicit scope, and verified expected deltas.

## License

Apache-2.0. See `LICENSE`.
