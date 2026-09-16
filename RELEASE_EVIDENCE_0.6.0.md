# SIF Core 0.6.0 Verification Evidence

## Candidate
- Branch: `feat/sif-core-0.6.0-live-postgres`
- The exact candidate commit is recorded by each final CI run in `MANIFEST.txt`; CI also asserts `git rev-parse HEAD == CANDIDATE_COMMIT` before artifact creation.
- Package version: `0.5.0` (release version intentionally not bumped)

## Final verification gates
- Exact candidate checkout: PASS
- Strict TypeScript build: PASS
- Unit tests: 31/31 PASS
- PostgreSQL schema bootstrap: PASS
- Live PostgreSQL integration: 4/4 PASS
- Crash-window characterization: PASS
- Candidate archive build: PASS
- Candidate archive verification: PASS
- Candidate artifact upload: PASS
- Environment: Ubuntu 24.04.5 LTS, Node 22.23.2, npm 10.9.8, PostgreSQL 16.15

## Hardening incorporated
1. Delegated authority cannot become unbounded when its parent authority expires.
2. Canonical object-key ordering is locale-independent.
3. Application metadata is included in event digests while reserved hash-chain metadata is excluded.
4. `PostgresTransactionalEventStore.append()` uses the transactional head-locking path.

## Candidate artifact evidence
The latest successful run produces an unpublished artifact whose name and manifest contain the exact checked-out candidate commit. The artifact is downloaded outside CI and independently checked for wrapper/archive integrity, GitHub digest agreement, manifest provenance, package identity, expected source structure, path safety, and SHA-256 identities.

See the final PR description and the preserved candidate evidence bundle for the exact run ID, artifact ID, wrapper digest, and archive hashes of the current branch HEAD.

## Provenance correction
An earlier pull-request workflow used the PR merge ref through `GITHUB_SHA` in the artifact manifest. Independent verification detected the mismatch. The workflow was corrected to explicitly select the PR head SHA, checkout that exact commit, assert worktree identity, record that candidate SHA in `MANIFEST.txt`, and use it in the uploaded artifact name.

## Release boundary
- `main` remains at Genesis `f4408d81375786e7a9f0715cf70609d0e257a67c`.
- Package version remains `0.5.0`.
- No `0.6.0` tag or registry publication.
- PR #2 remains open and unmerged.
- The candidate artifact/evidence gate is complete.
- This remains an unpublished verification candidate, not a package release.

## Explicitly not claimed
- arbitrary crash-point coverage
- full database/network recovery and reconciliation
- network-partition recovery
- production-scale PostgreSQL throughput/latency or HA/failover
- TLS/mTLS/SPIFFE federation
- OPA/Cedar integration
- KMS/HSM integration
- distributed consensus
- exactly-once external side effects
- production OpenTelemetry export
