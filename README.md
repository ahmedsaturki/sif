# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation begins with a small, verifiable TypeScript kernel and grows through evidence-gated integration layers.

## Repository baseline

- Genesis: `main` at `f4408d81375786e7a9f0715cf70609d0e257a67c`
- Verified kernel branch: `feat/sif-core-0.5.0`
- Live PostgreSQL verification branch: `feat/sif-core-0.6.0-live-postgres`
- Current candidate head: `38b7cc348a5adabc06d782ad6f475bbcb692da06`
- Current package version remains `0.5.0`; 0.6 is an integration-verification milestone, not yet a binary package release.

## SIF Core 0.5.0

The verified kernel includes append-only event streams, deterministic replay, optimistic concurrency, SHA-256 event integrity and stream hash chains, filesystem CAS, evidence/provenance/knowledge/semantic/lineage registries, scoped authority and attenuation, default-deny policy, durable outbox delivery, PostgreSQL transactional contracts, Ed25519 attestations, worker/inbox primitives, resumable projections, and self-model/reconstruction verification.

## Live PostgreSQL verification — 0.6 milestone

The current exact candidate head `38b7cc348a5adabc06d782ad6f475bbcb692da06` is covered by the latest CI workflow. The verification path checks out the exact candidate commit, then passes strict TypeScript build/tests, PostgreSQL schema bootstrap, live integration, crash-window characterization, candidate archive build/verification, and artifact upload.

The live integration suite covers **4/4 scenarios**: concurrent same-stream serialization, atomic transaction rollback, durable projection checkpoint persistence, and exclusive/reclaimable owner-fenced outbox leases.

The crash-window characterization covers two explicit windows: before-commit backend termination and after-commit/before-client-acknowledgement termination.

The hardening changes also add regression coverage for delegated-authority lifetime, locale-independent canonicalization, application metadata binding in event digests, and PostgreSQL inherited-append/stream-head synchronization.

## Verification

```text
Exact candidate checkout: PASS
Strict committed TypeScript build: PASS
Unit tests: PASS
Live PostgreSQL integration: 4/4 PASS
PostgreSQL crash-window characterization: PASS
Candidate archive build: PASS
Candidate archive verification: PASS
Candidate artifact upload: PASS
```

## Continuity and preserved knowledge

- `PROJECT_HISTORY.md` — implementation lineage
- `360_STATE.md` — repository/system state, laws, unknowns and gates
- `IMPLEMENTATION_LOG.md` — implementation stages and critical fixes
- `RESEARCH_SYNTHESIS.md` — reusable engineering patterns and research synthesis
- `ROADMAP.md` — evidence-gated next stages
- `DECISIONS.md` — architecture and engineering decisions
- `VERIFICATION_MATRIX.md` — capability-by-capability evidence state
- `RELEASE_NOTES_0.5.0.md` — 0.5.0 release scope and boundaries
- `REPOSITORY_360_BASELINE.md` — repository preservation baseline
- `SECURITY.md` — security boundaries
- `RELEASE_EVIDENCE_0.6.0.md` — 0.6 verification evidence and release rule
- `packages/sif-core/docs/ARCHITECTURE.md` — kernel architecture
- `packages/sif-core/IMPLEMENTATION_STATUS.md` — implementation and live verification status
- `artifacts/sif-core/0.5.0/ARTIFACT_INVENTORY.md` — artifact identity
- `artifacts/sif-core/0.5.0/SHA256SUMS` — binary artifact identity hashes
- `artifacts/sif-core/0.5.0/ARCHIVE_PRESERVATION.md` — byte-for-byte artifact preservation record

## Binary artifact preservation

The byte-for-byte SIF Core 0.5.0 source ZIP and npm TGZ remain preserved separately, with their SHA-256 identities recorded in `artifacts/sif-core/0.5.0/SHA256SUMS`.

An unpublished candidate artifact for the current exact head is also produced by CI and independently inspected. It is evidence for the candidate only; it is not a `0.6.0` published release.

## Verification boundary

The 0.6 live-Persistence milestone does not claim arbitrary crash-point coverage, full recovery/reconciliation after external database/network faults, network-partition recovery, TLS/mTLS/SPIFFE federation, OPA/Cedar adapters, KMS/HSM integration, distributed consensus, production OpenTelemetry exporters, exactly-once external side effects, or production-scale PostgreSQL HA/performance characterization.

## Release discipline

```text
SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT
```

No capability is considered complete because code exists. Promotion requires reproducible evidence, explicit scope, and verified expected deltas.

## License

Apache-2.0. See `LICENSE`.
