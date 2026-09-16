# SIF Core 0.6.0 Verification Evidence

## Candidate

- Branch: `feat/sif-core-0.6.0-live-postgres`
- Current candidate head before this documentation snapshot: `38b7cc348a5adabc06d782ad6f475bbcb692da06`
- Package version: `0.5.0` (release artifact version intentionally not bumped yet)
- Latest full verification run: GitHub Actions `209`
- PostgreSQL service: `16.15`
- Node: `22.23.2`
- npm: `10.9.8`

## Implementation verification — run 209

| Gate | Result |
|---|---|
| Exact candidate checkout | PASS |
| Artifact identity manifest | PASS |
| Strict TypeScript build | PASS |
| Unit tests | PASS |
| PostgreSQL schema bootstrap | PASS |
| Live PostgreSQL integration | 4/4 PASS |
| Crash-window characterization | PASS |
| Candidate archive build | PASS |
| Candidate archive verification | PASS |
| Candidate artifact upload | PASS |

The exact checkout gate verifies that the CI worktree commit equals the declared candidate commit. For pull-request events the workflow uses the PR head SHA rather than the pull-request merge ref for candidate provenance.

## Hardening incorporated

The current candidate includes and tests:

1. Delegated authority cannot become unbounded when its parent authority expires.
2. Canonical object-key ordering is locale-independent.
3. Application metadata is included in event digests while reserved hash-chain metadata is excluded from the digest input.
4. `PostgresTransactionalEventStore.append()` uses the transactional head-locking path so inherited append cannot desynchronize stream heads.

## Live PostgreSQL scenarios

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

Run 209 produced an unpublished candidate artifact from the exact candidate checkout:

- Artifact ID: `10431979722`
- Artifact name: `sif-core-unpublished-candidate-38b7cc348a5adabc06d782ad6f475bbcb692da06`
- GitHub artifact size: `109368` bytes
- GitHub artifact digest: `sha256:3b5529371f04ae7366aaf66c455f8c8e1fcab579176bb31631329b34fd886b6c`
- source ZIP SHA-256: `6f78d1c65767e5c9158acdbff8f48cdb849784e51ccfd42fd801358e084059d2`
- npm TGZ SHA-256: `ac735987335e47aef3ca954c33c0459b2d9fd8f6eb393d8fb22f657598630d93`
- package identity: `sif-core@0.5.0`
- artifact manifest commit: `38b7cc348a5adabc06d782ad6f475bbcb692da06`

The artifact wrapper was downloaded and independently inspected outside the GitHub Actions execution environment. The wrapper digest, archive integrity, package identity, provenance, expected source structure, and path-safety checks all passed.

## Boundaries

Not established by this milestone:

- arbitrary crash-point coverage
- full database/network recovery and reconciliation
- network-partition behavior
- production-scale PostgreSQL throughput/latency
- PostgreSQL HA/failover characterization
- exactly-once external side effects
- TLS/mTLS/SPIFFE federation
- OPA/Cedar integration
- KMS/HSM integration
- distributed consensus
- production OpenTelemetry export

## Release rule

A `0.6.0` package release requires a final promotion commit, fresh source and npm artifacts from that exact commit, SHA-256 identities, byte-preserving preservation, and independent verification. CI success and an unpublished candidate artifact do not themselves authorize merge, version bump, tagging, or publication.

## Current release status

**Implementation verification: complete for candidate head `38b7cc348a5adabc06d782ad6f475bbcb692da06`.**

**Artifact/evidence gate: complete for candidate head `38b7cc348a5adabc06d782ad6f475bbcb692da06`.**

**Binary release: not performed.** Package version remains `0.5.0`; no `0.6.0` tag, registry publication, or merge to `main` has been performed.

## Baseline preservation

- `main` remains preserved at genesis `f4408d81375786e7a9f0715cf70609d0e257a67c`.
- Existing 0.5.0 binary artifacts remain preserved separately.
- This milestone does not rewrite or replace the preserved 0.5.0 baseline.
