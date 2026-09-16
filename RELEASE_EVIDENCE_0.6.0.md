# SIF Core 0.6.0 Verification Evidence

## Candidate

- Branch: `feat/sif-core-0.6.0-live-postgres`
- Current candidate commit: `3f1a248b226122696dd612cd7740e3c851c9a31f`
- Package version: `0.5.0` (release artifact version intentionally not bumped yet)
- Final candidate verification: GitHub Actions run `169`
- PR merge-ref exercised by CI: `60ffcb55e31be5545f61ecc7f0298c7c5e9a8b75`
- PostgreSQL service: `16.15`
- Node: `22.23.2`
- npm: `10.9.8`

## Final candidate verification — run 169

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

**Implementation verification: complete.** Run 169 verified the current candidate commit on real PostgreSQL 16.15, including the compiled TypeScript tree, 27 unit tests, 4 live PostgreSQL scenarios, and the two exercised crash windows.

**Binary release: pending artifact channel.** Existing 0.5.0 artifacts remain preserved. No unverified 0.6.0 binary is fabricated or claimed. A 0.6.0 binary release remains gated on exact promotion-commit artifact production, SHA-256 identity, preservation, and independent verification.
