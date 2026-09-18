# SIF Verification Matrix — Historical 0.6 Live PostgreSQL Milestone

This document is a preserved historical verification record for the 0.6 Live PostgreSQL milestone. It is not the current SIF release or promotion gate. The current promoted application line is `feat/sif-adoption-layer-1.0.0`; the historical Phase 6 preservation branch referenced by older records is retained only as historical provenance.

| Surface | Status | Evidence / Boundary |
|---|---|---|
| TypeScript strict build | PASS | GitHub Actions run 169 on verified code candidate `3f1a248b226122696dd612cd7740e3c851c9a31f` |
| Core test suite | PASS | 27/27 tests passed in run 169 |
| Event append/replay | VERIFIED | Unit/integration coverage |
| Integrity hash chains | VERIFIED | Tamper-detection coverage |
| Filesystem CAS | VERIFIED | Digest addressing + corruption detection |
| Authority/delegation | VERIFIED | Scoped/expiring/attenuating behavior covered |
| Policy admission | VERIFIED | Default-deny + deny-overrides covered |
| Outbox persistence | VERIFIED | Durable JSONL + idempotent enqueue/retry covered |
| PostgreSQL transactional append | VERIFIED LIVE | Real PostgreSQL 16.15; event + stream head + outbox transaction exercised |
| PostgreSQL multi-client concurrency | VERIFIED LIVE | Two independent connections; exactly one same-version append succeeds |
| Projection checkpointing | VERIFIED LIVE | Real PostgreSQL persistence and deterministic round-trip |
| Worker lease/reclaim | VERIFIED LIVE | Real PostgreSQL claim, blocking, expiry/reclaim and owner fencing |
| Inbox idempotency | VERIFIED BY CONTRACT TEST | Duplicate-success and failed-retry coverage |
| Crash-window characterization | VERIFIED LIVE | Pre-COMMIT rollback and post-COMMIT/pre-ack committed-state preservation |
| Ed25519 attestation | VERIFIED | Sign/verify/tamper tests |
| Federation admission | VERIFIED LOCALLY | Local trust/capability/expiry gates tested |
| SPIFFE/mTLS | NOT IMPLEMENTED | Integration boundary |
| OPA/Cedar | NOT IMPLEMENTED | Integration boundary |
| KMS/HSM | NOT IMPLEMENTED | Integration boundary |
| Distributed consensus | NOT IMPLEMENTED | Integration boundary |
| Production OpenTelemetry | NOT VERIFIED | Integration boundary |
| Exactly-once external side effects | NOT CLAIMED | Requires effect-side idempotency/transaction semantics |
| Binary artifact preservation | VERIFIED | Existing 0.5.0 byte-for-byte artifacts preserved in Library; 0.6.0 artifacts not yet created |

## Historical 0.6 Promotion Gate

At the 0.6 implementation milestone, the implementation was live-verified on PostgreSQL 16.15 by GitHub Actions run 169 for verified code candidate `3f1a248b226122696dd612cd7740e3c851c9a31f`. At that historical point, artifact production and independent verification remained the next release-gate work. The later Phase 2–9 implementation and promotion history superseded this milestone record. NOT IMPLEMENTED / NOT VERIFIED / NOT CLAIMED entries remain hard boundaries and must not be represented as production capabilities.
