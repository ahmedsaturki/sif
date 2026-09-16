# SIF Core 0.6.0 Verification Evidence

## Candidate
- Branch: `feat/sif-core-0.6.0-live-postgres`
- Current candidate head before this documentation reconciliation: `11cde873fd655774ae5d00e9cc57a8b6ef8d95e3`
- Package version: `0.5.0` (release version intentionally not bumped)
- Latest full verification run: GitHub Actions `211` / `35062562107`
- PostgreSQL: `16.15`
- Node: `22.23.2`
- npm: `10.9.8`

## Implementation verification — run 211
| Gate | Result |
|---|---|
| Exact candidate checkout | PASS |
| Artifact identity manifest | PASS |
| Strict TypeScript build | PASS |
| Unit tests | 31/31 PASS |
| PostgreSQL schema bootstrap | PASS |
| Live PostgreSQL integration | 4/4 PASS |
| Crash-window characterization | PASS |
| Candidate archive build | PASS |
| Candidate archive verification | PASS |
| Candidate artifact upload | PASS |

## Hardening incorporated
1. Delegated authority cannot become unbounded when its parent authority expires.
2. Canonical object-key ordering is locale-independent.
3. Application metadata is included in event digests while reserved hash-chain metadata is excluded.
4. `PostgresTransactionalEventStore.append()` uses the transactional head-locking path.

## Candidate artifact from run 211
- Artifact ID: `10433161584`
- Artifact name: `sif-core-unpublished-candidate-11cde873fd655774ae5d00e9cc57a8b6ef8d95e3`
- GitHub artifact size: `109372` bytes
- GitHub artifact SHA-256: `31aa341717629f6f78499a597a9c82b888caa198bc440642ff662a88412cbb54`
- Source ZIP SHA-256: `93541f32f05ecef97b93ee3dd492a8eb7f98c5e16306a80292705e57bd0fe648`
- npm TGZ SHA-256: `ac735987335e47aef3ca954c33c0459b2d9fd8f6eb393d8fb22f657598630d93`
- Package identity: `sif-core@0.5.0`
- Artifact manifest commit: `11cde873fd655774ae5d00e9cc57a8b6ef8d95e3`

## Independent verification
The artifact was downloaded outside the GitHub Actions environment and independently checked for wrapper integrity, wrapper digest agreement, embedded source ZIP/TGZ integrity, package identity, exact commit provenance, expected source/test/sql/package paths, path safety, and SHA-256 identity.

## Important provenance correction
Earlier pull-request runs used the PR merge ref as `GITHUB_SHA` in the artifact manifest. Independent verification detected the mismatch. The workflow was corrected to check out and record the PR head SHA explicitly, and to verify `git rev-parse HEAD == CANDIDATE_COMMIT` before artifact creation.

## Release boundary
- `main` remains at Genesis `f4408d81375786e7a9f0715cf70609d0e257a67c`.
- Package version remains `0.5.0`.
- No `0.6.0` tag or registry publication.
- PR #2 remains open and unmerged.
- This is an unpublished candidate artifact, not a package release.

## Explicitly not claimed
- arbitrary crash-point coverage
- full database/network recovery and reconciliation
- network partitions
- production-scale PostgreSQL performance/HA
- TLS/mTLS/SPIFFE federation
- OPA/Cedar integration
- KMS/HSM integration
- distributed consensus
- exactly-once external side effects
- production OpenTelemetry export
