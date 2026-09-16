# SIF Core — 0.5.0 Kernel + 0.6 Live PostgreSQL + Phase 3 + Phase 4 Candidates

## Package identity

The package identity remains `sif-core@0.5.0`. Later implementation milestones remain isolated candidate lines until a separate promotion/release decision.

## Verified kernel and persistence

The core event-sourcing, integrity, CAS, authority, provenance, replay, persistence, outbox/inbox, worker, projection, and PostgreSQL transactional primitives remain preserved and are regression-tested by later candidate CI.

## Phase 3 Secure Federation candidate

The dedicated Phase 3 candidate covers canonical signed federation envelopes, peer identity and trust, semantic capability negotiation, sovereign local admission, durable/idempotent federation inboxes, bounded reconciliation and retry, provider-neutral transport, resource controls, and explicit fault injection.

## Phase 4 Policy & Governance candidate

The dedicated `feat/sif-core-0.8.0-policy-governance` candidate adds:

- immutable policy bundles and SHA-256 content identity;
- explicit registered/active/retired lifecycle;
- deterministic timestamp-aware historical resolution with fail-closed overlap handling;
- local deny-overrides and default-deny semantics;
- provider-neutral OPA/Cedar-shaped adapter boundary;
- provider result binding to the exact policy identity and digest;
- deterministic decision evidence and in-memory caller-immutable ledger;
- bounded policy, rule, context, version, and concurrent-evaluation resources;
- federated policy metadata subordinate to local authorization.

F4-001..F4-040 are executable in `packages/sif-core/test/policy-governance.test.ts`.

## Verification rule

The authoritative candidate identity is the branch HEAD. The authoritative verification record is a successful SIF Core CI run whose `head_sha` exactly equals that candidate. Dynamic CI run/artifact identifiers are intentionally excluded from mutable state documents to prevent self-invalidating provenance.

## Release boundary

No package version bump, registry publication, merge to `main`, production policy-provider deployment claim, or production federation claim is implied by candidate verification.

See the phase specifications, implementation contracts, test matrices, and evidence ledgers for exact boundaries.
