# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation begins with a small, verifiable TypeScript kernel and grows through evidence-gated integration layers.

## Repository baseline

- Genesis: `main` at `f4408d81375786e7a9f0715cf70609d0e257a67c`
- Verified kernel branch: `feat/sif-core-0.5.0`
- Live PostgreSQL verification branch: `feat/sif-core-0.6.0-live-postgres`
- Current package version remains `0.5.0`; 0.6 is an integration-verification milestone, not a binary package release.

## SIF Core 0.5.0

The verified kernel includes append-only event streams, deterministic replay, optimistic concurrency, SHA-256 event integrity and stream hash chains, filesystem CAS, evidence/provenance/knowledge/semantic/lineage registries, scoped authority and attenuation, default-deny policy, durable outbox delivery, PostgreSQL transactional contracts, Ed25519 attestations, worker/inbox primitives, resumable projections, and self-model/reconstruction verification.

## Live PostgreSQL verification — 0.6 milestone

GitHub Actions run 73 executed the committed SIF Core against a real PostgreSQL 16 service and passed the complete live integration suite. The four scenarios exercise the actual compiled implementation and verify concurrent same-stream serialization, atomic transaction rollback, durable projection checkpoint persistence, and exclusive/reclaimable owner-fenced outbox leases.

The live suite passed **4/4 scenarios**. The same CI job also passed artifact identity verification, the strict TypeScript build, the 27-test unit suite, and PostgreSQL schema bootstrap.

This milestone does not claim arbitrary crash-point recovery, production-scale PostgreSQL performance/HA, network fault tolerance, distributed consensus, or exactly-once external effects.

## Verification

```text
Local TypeScript build: PASS
Local tests: 27/27 PASS
GitHub Actions artifact identity: PASS
GitHub Actions committed build/test: PASS
GitHub Actions live PostgreSQL integration: 4/4 PASS
```

## Continuity and preserved knowledge

- `PROJECT_HISTORY.md` — 0.0.0 → current implementation lineage
- `360_STATE.md` — repository/system state, laws, unknowns and gates
- `IMPLEMENTATION_LOG.md` — implementation stages and critical fixes
- `RESEARCH_SYNTHESIS.md` — reusable engineering patterns and research synthesis
- `ROADMAP.md` — evidence-gated next stages
- `DECISIONS.md` — architecture and engineering decisions
- `VERIFICATION_MATRIX.md` — capability-by-capability evidence state
- `RELEASE_NOTES_0.5.0.md` — 0.5.0 release scope and boundaries
- `REPOSITORY_360_BASELINE.md` — repository preservation baseline
- `SECURITY.md` — security boundaries
- `packages/sif-core/docs/ARCHITECTURE.md` — kernel architecture
- `packages/sif-core/IMPLEMENTATION_STATUS.md` — implementation and live verification status
- `artifacts/sif-core/0.5.0/ARTIFACT_INVENTORY.md` — artifact identity
- `artifacts/sif-core/0.5.0/SHA256SUMS` — binary artifact identity hashes
- `artifacts/sif-core/0.5.0/ARCHIVE_PRESERVATION.md` — byte-for-byte artifact preservation record

## Binary artifact preservation

The byte-for-byte SIF Core 0.5.0 source ZIP and npm TGZ are preserved in the persistent Library. Their SHA-256 identities are recorded in `artifacts/sif-core/0.5.0/SHA256SUMS`. GitHub publication of binary release assets is intentionally a later release step; the repository never pretends an incomplete binary upload is a verified artifact.

## Verification boundary

The 0.6 live-Persistence milestone does not claim TLS/mTLS/SPIFFE federation transport, OPA/Cedar adapters, KMS/HSM integration, distributed consensus, production OpenTelemetry exporters, exactly-once external side effects, arbitrary crash-point recovery, or production-scale PostgreSQL HA/performance characterization.

## Release discipline

```text
SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT
```

No capability is considered complete because code exists. Promotion requires reproducible evidence, explicit scope, and verified expected deltas.

## License

Apache-2.0. See `LICENSE`.
