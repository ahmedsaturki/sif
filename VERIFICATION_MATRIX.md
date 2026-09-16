# SIF 0.5.0 Verification Matrix

| Surface | Status | Evidence / Boundary |
|---|---|---|
| TypeScript strict build | PASS | Local `npm test` executes `tsc -p tsconfig.json` successfully |
| Core test suite | PASS | 27/27 tests passed locally |
| Event append/replay | VERIFIED | Unit/integration coverage |
| Integrity hash chains | VERIFIED | Tamper-detection coverage |
| Filesystem CAS | VERIFIED | Digest addressing + corruption detection |
| Authority/delegation | VERIFIED | Scoped/expiring/attenuating behavior covered |
| Policy admission | VERIFIED | Default-deny + deny-overrides covered |
| Outbox persistence | VERIFIED | Durable JSONL + idempotent enqueue/retry covered |
| PostgreSQL transaction contract | CONTRACT TESTED | Typed fake-client transaction tests; no live server |
| PostgreSQL multi-client concurrency | NOT VERIFIED LIVE | Requires actual PostgreSQL deployment |
| Projection checkpointing | VERIFIED BY CONTRACT TEST | Resumable projection test coverage |
| Worker lease/reclaim | VERIFIED BY CONTRACT TEST | Lease owner/retry/delivery coverage |
| Inbox idempotency | VERIFIED BY CONTRACT TEST | Duplicate-success and failed-retry coverage |
| Ed25519 attestation | VERIFIED | Sign/verify/tamper tests |
| Federation admission | VERIFIED LOCALLY | Local trust/capability/expiry gates tested |
| SPIFFE/mTLS | NOT IMPLEMENTED | Integration boundary |
| OPA/Cedar | NOT IMPLEMENTED | Integration boundary |
| KMS/HSM | NOT IMPLEMENTED | Integration boundary |
| Distributed consensus | NOT IMPLEMENTED | Integration boundary |
| Production OpenTelemetry | NOT VERIFIED | Integration boundary |
| Exactly-once external side effects | NOT CLAIMED | Requires effect-side idempotency/transaction semantics |
| Binary artifact preservation | VERIFIED | Byte-for-byte source ZIP and npm TGZ preserved in persistent Library; hashes recorded |

## Promotion Gate

0.5.0 can be treated as a preserved development release candidate only where the evidence above says PASS/VERIFIED/CONTRACT TESTED. NOT VERIFIED/NOT IMPLEMENTED/NOT CLAIMED entries remain hard boundaries and must not be represented as production capabilities.
