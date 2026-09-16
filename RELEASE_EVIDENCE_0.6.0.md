# SIF Core 0.6.0 Verification Evidence

## Candidate

- Branch: `feat/sif-core-0.6.0-live-postgres`
- Final branch HEAD verified: `31c33c6a47e627b6b5c8e5dbd9649efa32bc0cba`
- Package version: `0.5.0` (release artifact version intentionally not bumped yet)
- Final-head verification: GitHub Actions run `136`
- PostgreSQL service: `16`

## Verified final-head gates — run 136

| Gate | Result |
|---|---|
| Artifact identity manifest | PASS |
| Strict TypeScript build | PASS |
| Unit tests | 27/27 PASS |
| PostgreSQL schema bootstrap | PASS |
| Live PostgreSQL integration | 4/4 PASS |
| Crash-window characterization | PASS |

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

A `0.6.0` package release requires a fresh source archive and npm package built from the final promotion commit, SHA-256 identities, byte-preserving artifact preservation, and independent verification. CI success alone does not publish or merge the candidate.

## Final-head rule

**Satisfied.** GitHub Actions run `136` is a fresh complete verification of the final branch HEAD `31c33c6a47e627b6b5c8e5dbd9649efa32bc0cba`. The remaining release gate is artifact production and independent byte-level verification; the package version remains `0.5.0` until that gate is completed.
