# SIF Phase 3 — Row-Level Evidence Ledger

## Status
Evidence ledger for `PHASE_3_TEST_MATRIX.md`. A row is marked `EVIDENCED` only when an executable test exercises the scenario and the exact candidate is covered by the CI run. This ledger does not grant Verified/promotion status by itself.

## Candidate Evidence

The ledger is intended to be read against the exact candidate checked out by the successful SIF Core CI run. The CI workflow verifies `CANDIDATE_COMMIT = github.sha`, executes the committed test tree, executes live PostgreSQL integration and crash-window tests, then builds and hashes an unpublished candidate archive.

## Evidence Identity Rule

An `EVIDENCED` row is execution-bound only when its listed evidence source is part of the committed candidate tree under test and the exact-head CI execution for that candidate completed successfully. A later source-tree change requires a new exact-head verification run before this ledger can continue to serve as evidence for the changed candidate.

## Row Mapping

| ID | Evidence source | State | Notes |
|---|---|---|---|
| F3-001 | `federation-trust.test.ts` — trusted peer authenticates only through bound trust anchor | EVIDENCED | Authenticated peer/session identity is established. |
| F3-002 | `federation-trust.test.ts` — unknown peer fails closed | EVIDENCED | Unknown peer rejects before semantic admission. |
| F3-003 | `federation-admission.test.ts` — envelope sender and authenticated peer identity must match | EVIDENCED | Identity/session mismatch is typed authentication failure. |
| F3-004 | `federation-trust.test.ts` — trusted peer authenticates only through bound trust anchor | EVIDENCED | Active anchor + registered peer path. |
| F3-005 | `federation-trust.test.ts` — unknown peer / mismatched trust-anchor binding | EVIDENCED | Unknown/unbound trust fails closed. |
| F3-006 | `federation-trust.test.ts` — revoked or expired trust anchor fails closed | EVIDENCED | Effective-time/revocation behavior covered. |
| F3-007 | `federation-envelope.test.ts` — canonical envelope ordering is deterministic | EVIDENCED | Canonical representation is deterministic. |
| F3-008 | `federation-envelope.test.ts` — missing mandatory federation envelope field fails closed | EVIDENCED | Empty mandatory message identity is rejected. |
| F3-009 | `federation-inbox.test.ts` — duplicate delivery returns existing record | EVIDENCED | One logical delivery/effect record. |
| F3-010 | `federation-envelope.test.ts` — distinct event identities remain distinct | EVIDENCED | MESSAGE and EVENT identity are separate. |
| F3-011 | `federation-envelope.test.ts` — signed content modification fails integrity/signature verification | EVIDENCED | Signed payload mutation is rejected. |
| F3-012 | `federation-envelope.test.ts` — invalid signature fails closed | EVIDENCED | Incorrect signature is rejected. |
| F3-013 | `federation-envelope.test.ts` — valid signature cannot be reused with changed sender | EVIDENCED | Sender is inside signed canonical content. |
| F3-014 | `federation-envelope.test.ts` — canonical payload/envelope ordering deterministic | EVIDENCED | Equivalent logical inputs canonicalize identically. |
| F3-015 | `federation-capability.test.ts` — compatible profiles produce scoped result | EVIDENCED | Negotiated session scope is explicit. |
| F3-016 | `federation-capability.test.ts` — unsupported mandatory capability fails closed | EVIDENCED | Mandatory capability mismatch rejects. |
| F3-017 | `federation-capability.test.ts` — syntactic match with different semantics fails closed | EVIDENCED | Semantic compatibility required. |
| F3-018 | `federation-capability.test.ts` — negotiated scope cannot be reused outside session | EVIDENCED | Scope rebinding rejects. |
| F3-019 | `federation-admission.test.ts` — trusted remote identity still requires local policy admission | EVIDENCED | Trust does not equal local authorization. |
| F3-020 | `federation-admission.test.ts` — explicit locally admitted evidence-read operation | EVIDENCED | Attributable local policy rule admits operation. |
| F3-021 | `federation-admission.test.ts` — remote authority cannot bypass local default deny | EVIDENCED | No local authority means denial. |
| F3-022 | `federation-admission.test.ts` — remote authority assertion cannot bypass local default deny | EVIDENCED | Unbounded remote grant is rejected. |
| F3-023 | `federation-inbox-crash-window.test.mjs` + `federation-fault-injection.test.ts` | EVIDENCED | Interrupted processing/crash recovery covered. |
| F3-024 | `federation-inbox.test.ts` — committed/verified states are idempotent + duplicate delivery | EVIDENCED | Duplicate handling preserves one logical record/effect. |
| F3-025 | `federation-inbox.test.ts` — declared retention window | EVIDENCED | Delayed delivery before expiry accepted; at expiry rejected. |
| F3-026 | `federation-inbox.test.ts` — reordered inbox messages | EVIDENCED | Distinct messages remain correct when delivered out of order. |
| F3-027 | `federation-retry.test.ts` — transient failures use bounded exponential backoff | EVIDENCED | Retry retains idempotency identity. |
| F3-028 | `federation-retry.test.ts` — authentication failure is terminal | EVIDENCED | Authentication failure maps to STOP, not retry. |
| F3-029 | `federation-retry.test.ts` — unknown outcome transitions to reconciliation | EVIDENCED | UNKNOWN_OUTCOME is not success/retry. |
| F3-030 | `federation-capability.test.ts` + `federation-transport.test.ts` | EVIDENCED | Negotiated resource limits reject oversized messages. |
| F3-031 | `federation-acceptance-gaps.test.ts` — repeated peer retry/reconnect attempts | EVIDENCED | Resource admission bounds repeated connection attempts. |
| F3-032 | `federation-reconciliation.test.ts` — same evidence twice | EVIDENCED | Duplicate observation is idempotent/deterministic. |
| F3-033 | `federation-acceptance-gaps.test.ts` — delayed remote observation | EVIDENCED | Occurrence/observation semantics retained. |
| F3-034 | `federation-reconciliation.test.ts` — conflicting observations become explicit conflicts | EVIDENCED | No silent overwrite. |
| F3-035 | `federation-reconciliation.test.ts` — remote divergence from immutable local history | EVIDENCED | Local history remains unchanged/authoritative. |
| F3-036 | `federation-acceptance-gaps.test.ts` — replay same remote cursor batch | EVIDENCED | Same cursor/batch is idempotent. |
| F3-037 | `federation-retry.test.ts` + `federation-transport.test.ts` | EVIDENCED | Peer unavailable is typed and bounded. |
| F3-038 | `federation-retry.test.ts` — authentication failure terminal | EVIDENCED | No retry changes authorization semantics. |
| F3-039 | `federation-capability.test.ts` — capability incompatibility | EVIDENCED | Fail-closed negotiation. |
| F3-040 | `federation-envelope.test.ts` + fault-injection signature scenario | EVIDENCED | Integrity/signature failure precedes admission. |
| F3-041 | `federation-fault-injection.test.ts` — forced connection loss after send | EVIDENCED | UNKNOWN_OUTCOME then reconciliation. |
| F3-042 | `federation-fault-injection.test.ts` — forced peer outage/recovery | EVIDENCED | Recovery retains identity and admission boundary. |
| F3-043 | `federation-acceptance-gaps.test.ts` — remote provenance cannot create local authority | EVIDENCED | Remote provenance alone is insufficient. |
| F3-044 | `federation-acceptance-gaps.test.ts` — cross-peer message identity collision | EVIDENCED | Collision is rejected rather than falsely deduped. |
| F3-045 | `federation-inbox.test.ts` — declared retention boundary | EVIDENCED | Delivery at/after expiry is rejected as replay. |
| F3-046 | `federation-acceptance-gaps.test.ts` — tampered provenance/reference | EVIDENCED | Signature boundary detects mutation. |
| F3-047 | `federation-acceptance-gaps.test.ts` — distinct occurrence/observation/receipt times | EVIDENCED | Time semantics remain separate facts. |
| F3-048 | `federation-acceptance-gaps.test.ts` — replayed historical message | EVIDENCED | Historical occurrence remains unchanged during replay. |
| F3-049 | `federation-acceptance-gaps.test.ts` — accepted federated evidence attribution | EVIDENCED | Source identity, provenance and local admission attribution preserved. |
| F3-050 | `federation-transport.test.ts` — encrypted metadata with unauthenticated peer | EVIDENCED | Encryption metadata is explicitly separate from authentication/trust; no concrete TLS deployment is claimed. |
| F3-051 | `federation-acceptance-gaps.test.ts` + `federation-trust.test.ts` | EVIDENCED | Remote domain cannot become local authority by claim. |
| F3-052 | `federation-acceptance-gaps.test.ts` — deterministic reconciliation replay | EVIDENCED | Identical inputs produce identical output. |
| F3-053 | `federation-fault-injection.test.ts` — forced authentication fault | EVIDENCED | Actual auth fault precedes admission. |
| F3-054 | `federation-fault-injection.test.ts` — forced signature tamper | EVIDENCED | Actual tamper is detected before admission callback. |
| F3-055 | `federation-fault-injection.test.ts` — forced duplicate delivery | EVIDENCED | Duplicate was actually delivered and contained. |
| F3-056 | `federation-fault-injection.test.ts` — forced peer outage | EVIDENCED | Outage occurs and recovery succeeds. |
| F3-057 | `federation-fault-injection.test.ts` — forced connection loss after send | EVIDENCED | Ambiguous result is reconciled rather than assumed successful. |
| F3-058 | `federation-inbox.test.ts` + live PostgreSQL integration | EVIDENCED | Duplicate concurrent delivery is serialized/idempotent; live DB also proves writer serialization. |
| F3-059 | `federation-reconciliation.test.ts` | EVIDENCED | Concurrent divergent reconciliation remains explicit and preserves first observation. |
| F3-060 | SIF Core CI artifact build/verify/upload | EVIDENCED | Exact checkout, manifest, SHA-256 checks and candidate artifact are tied to the same CI run. |

## Boundary Notes

- This ledger documents executable coverage; it does not declare the candidate `Verified` until the promotion gate accepts the complete evidence set.
- The exact candidate/run/artifact provenance is intentionally not self-embedded in this mutable ledger. The authoritative exact binding is the PR's current HEAD plus the exact-head CI run and artifact produced from that HEAD.
- Any source-tree change requires a new exact-head CI execution before this ledger can continue to serve as evidence for that changed candidate.
- Provider-neutral transport remains deliberately separate from deployment-specific TLS/mTLS/SPIFFE. F3-050 proves the security principle that encryption is not trust using an explicit transport security flag; it does not claim a production TLS deployment.
- The package version remains `0.5.0`; no publication or merge is implied.
