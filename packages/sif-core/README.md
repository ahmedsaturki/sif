# SIF Core 0.5.0

Dependency-free TypeScript kernel for a Sovereign Intelligence Fabric.

## Included in the package

- append-only event streams with optimistic concurrency
- deterministic replay and projections
- SHA-256 event integrity / stream hash chains
- filesystem content-addressed storage (CAS)
- evidence / provenance / semantic registries
- scoped, expiring authority and attenuating delegation
- default-deny policy admission with deny-overrides
- durable JSONL outbox
- transactional PostgreSQL event + outbox adapter
- per-stream PostgreSQL serialization via `sif_stream_heads` row locking
- PostgreSQL artifact metadata / projection checkpoint schema
- Ed25519 attestations
- lineage / reconstruction verification
- capability-gated execution
- durable outbox leasing/reclaim and inbox idempotency primitives
- resumable projections
- Phase 3 Secure Federation kernel boundaries for signed envelopes, trust, capability negotiation, admission, reconciliation, retry, provider-neutral transport, resource governance, and durable federation inboxes

## Package and milestone boundary

The published/unpublished package identity in this repository remains `sif-core@0.5.0`.

The Phase 2 `0.6` label is an implementation/integration verification milestone, not a package release. Phase 3 Secure Federation is developed on an isolated feature branch and draft pull request; its verification evidence does not change the package version or imply registry publication.

## Current Secure Federation candidate

The current Phase 3 candidate is governed by:

- `PHASE_3_FEDERATION_SPEC.md`
- `PHASE_3_IMPLEMENTATION_CONTRACT.md`
- `PHASE_3_TEST_MATRIX.md`
- `PHASE_3_EVIDENCE_LEDGER.md`

The candidate includes executable federation coverage for identity and trust, canonical signed envelopes, semantic capability negotiation, sovereign local admission, durable/idempotent federation inbox behavior, bounded reconciliation and retry, provider-neutral transport, resource abuse controls, fault injection, and live PostgreSQL/crash-window characterization.

The authoritative provenance rule is exact-head based: the current branch HEAD must be matched by a successful SIF Core CI execution before its evidence is considered valid. Dynamic CI run/artifact identifiers are intentionally not embedded in committed state documents because doing so would make the provenance self-invalidating.

## Verification boundary

Phase 3 CI currently verifies the committed source tree through strict TypeScript build/tests, live PostgreSQL integration, federation inbox crash-window characterization, PostgreSQL crash-window characterization, exact candidate archive construction/extraction/SHA-256 verification, and candidate artifact upload.

Passing these checks does not claim a production TLS/mTLS/SPIFFE deployment, production-scale HA/performance, distributed consensus, exactly-once external side effects, or registry publication.

## Guarantees and boundaries

- Durable PostgreSQL outbox leasing uses `FOR UPDATE SKIP LOCKED` with an explicit `lease_owner`; expired leases can be reclaimed.
- PostgreSQL inbox deduplicates `(consumer_id, message_id)` and removes an incomplete claim on handler failure so transient failures remain retryable.
- Resumable projections persist a checkpoint after applying new events and verify contiguous stream versions.
- Transactional append commits the event, stream head, and outbox records together; a database constraint failure rolls the transaction back as one unit.
- Event history remains the authoritative source; projections and checkpoints are derived state.
- Delivery is at-least-once. Exactly-once external side effects require the side effect and inbox completion to participate in the same transaction or be made independently idempotent.
- Federation trust is distinct from transport encryption, and remote trust does not create local application authority.
- Federation reconciliation is bounded and explicit: conflicts do not silently overwrite local history or advance the synchronization cursor past a conflict.
- The package version remains `0.5.0` until a separate promotion/release process authorizes a new artifact line.

## Verification boundaries

The following are not claimed as production-live by this package candidate: deployment-specific TLS/mTLS/SPIFFE transport, OPA/Cedar integration, KMS/HSM integration, distributed consensus, production OpenTelemetry export, exactly-once external side effects, and production-scale PostgreSQL performance/HA characterization.

See `docs/ARCHITECTURE.md`, `IMPLEMENTATION_STATUS.md`, and `sql/postgres-schema.sql`.
