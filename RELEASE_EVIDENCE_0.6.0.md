# SIF Core 0.6.0 Verification Evidence

## Candidate

- Branch: `feat/sif-core-0.6.0-live-postgres`
- Current candidate commit: `16ece4e78b7d288a8bd1a7eaedd6ec4c5834a910`
- Package version: `0.5.0` (release artifact version intentionally not bumped yet)
- Final implementation verification: GitHub Actions runs `192` (push) and `193` (pull request)
- PostgreSQL service: `16.15`
- Node: `22.23.2`
- npm: `10.9.8`

## Implementation verification — runs 192/193

| Gate | Result |
|---|---|
| Artifact identity manifest | PASS |
| Strict TypeScript build | PASS |
| Unit tests | 27/27 PASS |
| PostgreSQL schema bootstrap | PASS |
| Live PostgreSQL integration | 4/4 PASS |
| Crash-window characterization | PASS |
| Candidate archive build | PASS |
| Candidate archive verification | PASS |
| Candidate artifact upload | PASS |

## Live integration scenarios

1. Concurrent same-stream append serialization with two independent PostgreSQL connections.
2. Atomic rollback of event, stream head, and outbox state on constraint failure.
3. Durable projection checkpoint persistence and deterministic round-trip.
4. Exclusive outbox leasing, expiry/reclaim, stale-owner fencing, and successful delivery by the current owner.

## Crash-window characterization

The direct SQL characterization exercises two explicit windows against a real PostgreSQL backend:

- **Before COMMIT:** backend termination produces rollback; no event, stream head, or outbox partial state remains; retry admission succeeds.
- **After COMMIT / before acknowledgement:** backend termination preserves the committed event and stream head; the direct SQL scenario contains no outbox row because no delivery item is created there.

This characterizes the tested windows only. It is not proof of arbitrary crash recovery or distributed recovery correctness.

## Candidate artifact

GitHub Actions produced an unpublished candidate artifact from the exact branch head:

- Artifact ID: `10432382345`
- Artifact name: `sif-core-unpublished-candidate-16ece4e78b7d288a8bd1a7eaedd6ec4c5834a910`
- GitHub artifact size: `106319` bytes
- GitHub artifact digest: `sha256:10aa09116d8f97793c4b033e7d61095ea760237dba172c4dfa6638f6b6f1bbf6`
- source ZIP SHA-256: `bda471d5049ad411e7af068e78542d1f3a719dd3934d159e1a0eb5325562c407`
- npm TGZ SHA-256: `45de20eb191c2084d5827be524323573d72f72aba22ffa84d0bc581d0d609488`
- package identity: `sif-core@0.5.0`
- source archive provenance: exact commit `16ece4e78b7d288a8bd1a7eaedd6ec4c5834a910`

## Independent verification

The uploaded artifact was downloaded and inspected outside the GitHub Actions execution environment.

Verified independently:

- GitHub artifact wrapper ZIP integrity
- GitHub artifact wrapper digest matches GitHub-reported SHA-256
- embedded source ZIP integrity
- embedded npm TGZ integrity
- package name/version identity in the TGZ
- exact commit provenance in the candidate manifest
- expected source/test/sql/package paths in the source archive
- path-safety checks for absolute paths and traversal entries
- source ZIP and npm TGZ SHA-256 identities
- non-empty artifact payloads

An independent verification bundle and local hash manifest are preserved alongside the downloaded candidate artifacts in the working environment.

## Boundaries

Not established by this milestone:

- arbitrary crash-point coverage
- full database/network recovery and reconciliation
- network-partition behavior
- production-scale PostgreSQL throughput/latency
- PostgreSQL HA/failover characterization
- exactly-once external side effects
- TLS/mTLS/SPIFFE federation transport
- OPA/Cedar integration
- KMS/HSM integration
- distributed consensus
- production OpenTelemetry export

## Release rule

A `0.6.0` package release requires a fresh source archive and npm package built from the promotion commit, SHA-256 identities, byte-preserving artifact preservation, and independent verification. CI success and candidate artifact existence do not themselves authorize merge, version bump, tagging, or publication.

## Current release status

**Implementation verification: complete.** The exact current branch head `16ece4e78b7d288a8bd1a7eaedd6ec4c5834a910` passed the full CI verification path in runs `192` and `193`, including live PostgreSQL testing and candidate archive verification/upload.

**Candidate artifact/evidence gate: complete.** The exact-head candidate source ZIP and npm TGZ were produced by CI and independently verified outside the CI environment.

**Binary release: not performed.** The package version remains `0.5.0`; no `0.6.0` tag, registry publication, or merge has been performed.

## Baseline preservation

- `main` remains preserved at genesis `f4408d81375786e7a9f0715cf70609d0e257a67c`.
- Existing 0.5.0 binary artifacts remain preserved separately.
- This milestone does not rewrite or replace the preserved 0.5.0 baseline.
