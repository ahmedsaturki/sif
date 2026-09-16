# SIF Phase 3 — Secure Federation Test Matrix

## Status
TEST MATRIX — executable acceptance contract. No row is PASS until the exact test execution and evidence are recorded against the candidate commit.

## Evidence Rule
A test result is valid only when:
- the intended test actually executed;
- the claimed fault actually occurred for fault tests;
- the test identifies the exact candidate/runtime under test;
- output/evidence is preserved;
- security invariants are checked independently of happy-path success.

## Matrix

| ID | Area | Scenario | Expected Result | Gate |
|---|---|---|---|---|
| F3-001 | Identity | Valid authenticated peer | Peer identity is established and bound to session | Required |
| F3-002 | Identity | Missing/invalid peer identity | Admission stops with authentication failure | Required |
| F3-003 | Identity | Identity/session mismatch | Admission stops; mismatch is evidenced | Required |
| F3-004 | Trust | Trusted bundle/issuer | Peer accepted when all trust conditions hold | Required |
| F3-005 | Trust | Unknown/untrusted issuer | Peer rejected; no semantic admission | Required |
| F3-006 | Trust | Retired/expired trust material | Peer rejected according to effective-time rules | Required |
| F3-007 | Envelope | Canonical valid envelope | Deterministic parse and canonical representation | Required |
| F3-008 | Envelope | Missing mandatory field | Fail closed with typed protocol/schema error | Required |
| F3-009 | Identity | Same message_id delivered twice | One logical delivery/effect; duplicate safely handled | Required |
| F3-010 | Identity | Distinct event_ids sharing message transport history | Message and event identity remain distinct | Required |
| F3-011 | Integrity | Signed content modified | Integrity/signature verification fails before admission | Required |
| F3-012 | Signature | Invalid signature | Message rejected before semantic admission | Required |
| F3-013 | Signature | Valid signature from wrong declared sender | Sender binding fails | Required |
| F3-014 | Signature | Canonicalization ambiguity | Equivalent logical input produces one canonical signed representation | Required |
| F3-015 | Capability | Compatible negotiated set | Negotiation succeeds with explicit scoped result | Required |
| F3-016 | Capability | Unsupported mandatory capability | Negotiation fails closed | Required |
| F3-017 | Capability | Syntactically compatible but semantically incompatible version | Negotiation/admission fails | Required |
| F3-018 | Capability | Negotiated capability attempted outside scope/session | Attempt rejected | Required |
| F3-019 | Authority | Trusted remote sender requests local effect | Local admission still required | Required |
| F3-020 | Authority | Explicitly authorized remote operation | Effect admitted only under attributable local policy decision | Required |
| F3-021 | Authority | Remote command without local authority | Command rejected; no local effect | Required |
| F3-022 | Authority | Remote assertion attempts unbounded local grant | Grant rejected or bounded by local policy | Required |
| F3-023 | Inbox | Delivered but processing interrupted | Durable inbox state preserves replay-safe recovery | Required |
| F3-024 | Inbox | Duplicate after committed effect | Duplicate does not create second effect | Required |
| F3-025 | Inbox | Delayed message | Message handled under declared replay/retention policy | Required |
| F3-026 | Inbox | Reordered message sequence | Processing remains correct within declared ordering guarantees | Required |
| F3-027 | Retry | Transient delivery failure | Retry only after idempotency/retry admission | Required |
| F3-028 | Retry | Authorization failure | No automatic retry that bypasses policy | Required |
| F3-029 | Retry | Unknown outcome | Result remains unknown until reconciliation/verification | Required |
| F3-030 | Resource | Oversized envelope | Rejected before unbounded processing | Required |
| F3-031 | Resource | Peer retry storm | Backpressure/rate limits prevent admission bypass and uncontrolled amplification | Required |
| F3-032 | Reconciliation | Same evidence received repeatedly | Deterministic idempotent handling | Required |
| F3-033 | Reconciliation | Delayed remote observation | Local history preserved; observation recorded with time semantics | Required |
| F3-034 | Reconciliation | Conflicting local/remote observations | Explicit conflict/evidence record; no silent overwrite | Required |
| F3-035 | Reconciliation | Remote state differs from local event history | Local immutable history remains authoritative | Required |
| F3-036 | Reconciliation | Replay same remote cursor/batch | No duplicate committed effects | Required |
| F3-037 | Failure | Peer unavailable | Typed availability failure; bounded recovery path | Required |
| F3-038 | Failure | Authentication failure | No retry that changes authorization semantics | Required |
| F3-039 | Failure | Capability incompatibility | Fail closed; incompatibility recorded | Required |
| F3-040 | Failure | Invalid integrity/signature | Fail closed before admission | Required |
| F3-041 | Recovery | Connection loss during delivery | Unknown/failed outcome classified correctly and reconciled | Required |
| F3-042 | Recovery | Peer returns after outage | Recovery resumes without bypassing admission or replay protection | Required |
| F3-043 | Security | Remote provenance claims elevated trust | Provenance does not become authority by itself | Required |
| F3-044 | Security | Cross-peer message identity collision | Collision isolated by declared identity scope; no false deduplication | Required |
| F3-045 | Security | Replay outside permitted window | Rejected or quarantined per declared policy | Required |
| F3-046 | Security | Tampered provenance/reference data | Signature/integrity/admission failure | Required |
| F3-047 | Time | Occurrence time differs from processing time | Both semantics retained; ordering not inferred from timestamp alone | Required |
| F3-048 | Time | Replayed historical message | Historical semantics preserved; current-time processing does not rewrite occurrence facts | Required |
| F3-049 | Provenance | Accepted federated evidence | Source identity, verification, admission and exact artifact/runtime provenance preserved | Required |
| F3-050 | Boundary | Transport is encrypted but peer not locally trusted | Encryption alone does not admit peer | Required |
| F3-051 | Boundary | Remote domain claims local authority | Local domain remains sovereign; claim is evidence only | Required |
| F3-052 | Determinism | Same input/evidence set replayed | Same decision/result within declared deterministic scope | Required |
| F3-053 | Fault injection | Forced authentication fault | Fault mechanism confirms actual auth failure before recording PASS | Required |
| F3-054 | Fault injection | Forced signature tamper | Tamper actually detected; no admission | Required |
| F3-055 | Fault injection | Forced duplicate delivery | Duplicate actually delivered; idempotency behavior verified | Required |
| F3-056 | Fault injection | Forced peer outage | Outage actually occurs; recovery behavior verified | Required |
| F3-057 | Fault injection | Forced connection loss after send | Unknown/ambiguous outcome actually created and reconciled | Required |
| F3-058 | Concurrency | Concurrent messages targeting same logical effect | Serialization/idempotency prevents duplicate effect | Required |
| F3-059 | Concurrency | Concurrent reconciliation updates | Conflicts explicit; no silent history mutation | Required |
| F3-060 | Artifact | Candidate archive built from exact checkout | Manifest and archive provenance match exact candidate commit | Required |

## Implemented Coverage Notes

The current candidate line now has executable coverage for:
- canonical federation envelopes, integrity and provider-neutral signing;
- trust anchors, peer bindings, revocation and effective-time validation;
- versioned trust-bundle activation/retirement and deterministic resolution;
- durable federated inbox state progression and PostgreSQL crash-window characterization;
- session-scoped capability negotiation and semantic compatibility;
- sovereign local admission through the existing policy engine;
- bounded reconciliation with duplicate/divergence/conflict behavior;
- bounded delivery retry with explicit `RETRY`, `STOP`, and `RECONCILE` decisions;
- provider-neutral transport session/send/close contracts;
- resource governance for sessions, inbox work, replay retention, rate limits and reconciliation batch size;
- executable forced authentication, signature-tamper, duplicate-delivery, peer-outage/recovery, and post-send unknown-outcome/reconciliation scenarios (F3-053..057).

## Minimum Scenario Classes
The implementation must include at least one executable test for every Required row and additional cases where implementation details create new failure modes.

The following classes must appear in CI before promotion:

1. unit tests for canonicalization, envelope validation, error taxonomy, signing and capability semantics;
2. integration tests for durable inbox/idempotency and local admission;
3. transport/security tests for peer identity and trust bundle behavior;
4. fault-injection tests that prove the targeted fault happened;
5. reconciliation tests for duplicate, delayed, reordered and conflicting observations;
6. resource-abuse tests for bounds/backpressure;
7. artifact/provenance tests tied to exact candidate checkout.

## Non-Claims
Passing this matrix does not by itself establish:
- distributed consensus;
- arbitrary network fault recovery;
- production-scale HA/performance;
- secure deployment-specific TLS/mTLS/SPIFFE configuration;
- registry publication or release readiness without the separate promotion gate.
