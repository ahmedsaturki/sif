# SIF 360° State

## Identity
- Repository: `ahmedsaturki/sif`
- Product: Sovereign Intelligence Fabric
- Current package baseline: `SIF Core 0.5.0`
- Current integration verification milestone: `0.6 Live PostgreSQL`
- Implementation language: TypeScript
- Core dependency policy: dependency-free kernel
- Primary persistence target: PostgreSQL

## Repository State

- `main` remains at Genesis `f4408d81375786e7a9f0715cf70609d0e257a67c`.
- `feat/sif-core-0.5.0` remains the preserved kernel baseline.
- `feat/sif-core-0.6.0-live-postgres` is the live-persistence candidate line.
- Current candidate commit: `b01ba3f56aa7cd20436ddec8e0628944e99c6b51`.
- PR #2 remains open and unmerged.

## Verified Kernel

Implemented and tested:
- append-only events
- optimistic concurrency
- per-stream hash chains
- deterministic replay
- resumable projections
- SHA-256 event integrity
- filesystem CAS
- evidence/provenance/knowledge/semantic/lineage registries
- scoped and expiring authority
- attenuating delegation
- default-deny policy with deny-overrides
- durable outbox and leases
- durable inbox/idempotency
- PostgreSQL transactional event/outbox contracts
- explicit per-stream row serialization
- Ed25519 attestations
- capability-gated execution
- self-model/reconstruction verification

## Live PostgreSQL 0.6 Verification

GitHub Actions **run 143** verified commit `b01ba3f56aa7cd20436ddec8e0628944e99c6b51` against a real PostgreSQL 16 service. The actual compiled implementation was exercised through a dependency-free PostgreSQL wire-protocol harness and direct SQL crash-window characterization.

Verified live scenarios:

1. Concurrent same-stream append serialization: independent connections contend for the same expected version and exactly one event/outbox pair remains.
2. Atomic rollback: a constraint failure rolls back the event, stream head, and outbox together with no partial commit.
3. Projection checkpoint persistence: checkpoint state survives through the PostgreSQL store and round-trips deterministically.
4. Outbox worker lifecycle: one worker claims the item, another is blocked while the lease is valid, the item is reclaimed after expiry, stale-owner delivery is fenced, and the new owner can mark it delivered.
5. Crash-window characterization: terminating the PostgreSQL backend before commit leaves no partial state and permits retry; terminating it after commit but before client acknowledgement preserves the committed event and stream head.

## Evidence State

- Final-head CI: PASS — run 143
- Artifact identity manifest: PASS
- Strict committed TypeScript build + tests: PASS
- Unit tests: 27/27 PASS
- PostgreSQL schema bootstrap: PASS
- Live PostgreSQL integration: 4/4 PASS
- Crash-window characterization: PASS

The final-head CI gate is satisfied for the current candidate commit.

## Release / Promotion State

The implementation milestone is verified, but `0.6.0` is **not yet an artifact release**. Package version remains `0.5.0` until a fresh source ZIP and npm TGZ are built from the promotion commit, SHA-256 identities are recorded, byte-preserving artifacts are preserved, and the artifacts are independently verified.

The 0.5.0 binary artifacts remain preserved in the persistent Library. Run 143 produced no GitHub Actions artifacts, and the current execution environment cannot safely clone from `github.com` because DNS resolution is unavailable; therefore no unverified 0.6.0 binary is fabricated or claimed.

## Explicit Unknown / Not Claimed

- arbitrary process/database crash-point coverage
- full recovery/reconciliation after external database/network faults
- network-partition recovery
- TLS/mTLS/SPIFFE federation transport
- OPA/Cedar adapter
- KMS/HSM secret integration
- distributed consensus
- production OpenTelemetry exporter
- exactly-once external side effects
- production-scale PostgreSQL performance/HA characterization

## Governing Laws

- configured != live != usable != production-safe
- exit code != semantic success
- event history is authoritative
- snapshots/projections are derived
- no promotion without reproducible evidence
- no authority without explicit scope
- retry requires idempotency
- recovery requires reconciliation
- remote evidence does not become local authority automatically
- conceptual research is not implementation evidence

## Release Discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
