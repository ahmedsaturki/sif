# SIF Core 0.6.0 Verification Evidence

## Candidate

- Branch: `feat/sif-core-0.6.0-live-postgres`
- Current candidate commit: `0df0385c94e59762aab2f5e74ec46702a919453e`
- Package version: `0.5.0` (release artifact version intentionally not bumped yet)
- Implementation verification baseline: GitHub Actions run `143` on `b01ba3f56aa7cd20436ddec8e0628944e99c6b51`
- Current candidate verification: fresh CI required after documentation reconciliation
- PostgreSQL service: `16`

## Verified implementation gates — run 143

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

A `0.6.0` package release requires a fresh source archive and npm package built from the promotion commit, SHA-256 identities, byte-preserving artifact preservation, and independent verification. CI success alone does not publish or merge the candidate.

## Current release status

**Implementation verification baseline: complete.** Run 143 verified the implementation commit on real PostgreSQL 16.

**Current branch state: pending final-candidate CI.** Documentation/evidence reconciliation commits were intentionally made after run 143. The current candidate must pass a fresh complete CI run before artifact production or promotion.

**Binary release: pending artifact channel.** Run 143 produced no Actions artifacts; no unverified 0.6.0 binary is fabricated or claimed.
