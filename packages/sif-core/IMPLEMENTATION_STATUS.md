# SIF Core — 0.5.0 Kernel + 0.6 Live PostgreSQL + Phase 3 Candidate

## Package identity

The package identity remains `sif-core@0.5.0`. The repository may contain later implementation milestones on isolated candidate branches without implying a package version bump or registry publication.

## Verified kernel

- TypeScript strict build passes on the current candidate line.
- Core event sourcing, integrity, CAS, authority, policy, provenance, replay, persistence, outbox/inbox, workers, and projection primitives remain preserved.
- PostgreSQL transactional append uses a dedicated per-stream head row with `FOR UPDATE` serialization.
- Event and outbox rows are committed in one transaction.
- Durable PostgreSQL outbox leasing/reclaim and inbox idempotency semantics are implemented by contract.
- Resumable projection runner with persisted checkpoints is implemented.

## Live PostgreSQL verification boundary

The Phase 2 `0.6` milestone has been exercised against a real PostgreSQL 16 service in GitHub Actions. The workflow verifies concurrent same-stream serialization, atomic rollback, projection checkpoint durability, outbox leasing/reclaim/owner fencing, durable federation inbox behavior, and explicit crash-window characterization.

The `0.6` label is an implementation/integration milestone, not a published `0.6.0` package release.

## Phase 3 Secure Federation candidate

The isolated branch `feat/sif-core-0.7.0-secure-federation` extends the kernel with dependency-free federation boundaries covering:

- canonical federation envelopes and signed content
- payload SHA-256 integrity and typed federation failures
- peer identity, trust anchors, revocation/effective-time validation and transport binding
- versioned trust-bundle lifecycle
- session-scoped capability negotiation with semantic compatibility
- sovereign local admission through the existing default-deny PolicyEngine
- durable federation inbox state `DELIVERED → PROCESSED → COMMITTED → VERIFIED`
- replay/idempotency controls and retention-window enforcement
- bounded deterministic reconciliation with explicit conflicts and fail-closed cursor advancement
- bounded retry with explicit `RETRY`, `STOP`, and `RECONCILE` outcomes
- provider-neutral transport session/send/close contracts
- resource/abuse governance
- executable forced-fault scenarios for authentication, signature tamper, duplicate delivery, peer outage/recovery and post-send unknown outcome

The Phase 3 contract and evidence ledger map the Required F3-001..F3-060 acceptance scenarios to executable tests or explicit boundary evidence.

## Current verification rule

The current Phase 3 candidate is considered execution-bound only when its exact branch HEAD matches a successful exact-head SIF Core CI run. That run verifies the exact checkout, strict committed build/tests, live PostgreSQL integration, federation and PostgreSQL crash-window characterization, candidate archive construction/extraction/SHA-256 checks, and artifact upload.

Dynamic CI run/artifact identifiers are intentionally not embedded in this file or other mutable state documents because doing so would make the provenance self-invalidating when the source tree changes. The branch HEAD plus the matching exact-head CI run is the authoritative binding.

## Release boundary

No package version bump, registry publication, merge to `main`, production federation deployment claim, or production-scale HA/performance claim is implied by the Phase 3 candidate verification. A separate promotion/release decision is required before changing that boundary.

## Explicit non-claims

- deployment-specific TLS/mTLS/SPIFFE production configuration
- OPA/Cedar integration
- KMS/HSM integration
- distributed consensus
- production OpenTelemetry export
- exactly-once external side effects
- production-scale PostgreSQL performance/HA characterization
- arbitrary crash-point coverage beyond the characterized scenarios
- network-partition recovery beyond the implemented bounded contracts
