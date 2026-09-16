# SIF Phase 4 — Policy & Governance Test Matrix

## Status
Executable acceptance contract. A row is `EVIDENCED` only when the intended test actually executes against the exact candidate and the required evidence is preserved.

| ID | Area | Scenario | Expected Result | Gate |
|---|---|---|---|---|
| F4-001 | Bundle | Register valid immutable policy version | Stored with deterministic digest | Required |
| F4-002 | Bundle | Duplicate version with identical content | Idempotent or explicitly duplicate; no replacement | Required |
| F4-003 | Bundle | Duplicate version with different content | Integrity failure; original remains unchanged | Required |
| F4-004 | Bundle | Invalid policy content | Fail closed | Required |
| F4-005 | Lifecycle | Activate policy version | Explicit active lifecycle recorded | Required |
| F4-006 | Lifecycle | Retire policy version | Current resolution excludes retired version | Required |
| F4-007 | Lifecycle | Overlapping active versions | Ambiguous resolution fails closed | Required |
| F4-008 | Lifecycle | Resolve by evaluation timestamp | Deterministic applicable version | Required |
| F4-009 | Lifecycle | Expired policy | Current evaluation rejects expired policy | Required |
| F4-010 | Request | Missing/invalid request identity | Fail closed | Required |
| F4-011 | Decision | Explicit allow | Returns attributable ALLOW | Required |
| F4-012 | Decision | Explicit deny | Returns attributable DENY | Required |
| F4-013 | Decision | No matching rule | Default DENY | Required |
| F4-014 | Decision | Matching allow + deny | Deny overrides allow | Required |
| F4-015 | Adapter | Provider returns ALLOW | Normalized and locally attributable | Required |
| F4-016 | Adapter | Provider returns DENY | Normalized and locally attributable | Required |
| F4-017 | Adapter | Provider unavailable | INDETERMINATE/typed failure; never implicit ALLOW | Required |
| F4-018 | Adapter | Malformed provider result | Fail closed | Required |
| F4-019 | Adapter | Unsupported provider semantics | Fail closed | Required |
| F4-020 | Provenance | Decision evidence records exact policy version/digest | Reconstruction inputs preserved | Required |
| F4-021 | Provenance | Request context changes | Request digest changes; old decision remains attributable | Required |
| F4-022 | Authority | Remote/federated assertion requests local capability | Local policy still required | Required |
| F4-023 | Authority | Trusted remote provenance claims allow | Remote claim cannot create local ALLOW | Required |
| F4-024 | Resource | Oversized policy bundle | Rejected before expensive evaluation | Required |
| F4-025 | Resource | Excessive rule count | Rejected before evaluation | Required |
| F4-026 | Resource | Excessive context | Rejected or bounded deterministically | Required |
| F4-027 | Resource | Concurrent evaluation limit exceeded | Typed resource failure; no bypass | Required |
| F4-028 | Determinism | Same request + exact policy replayed | Same normalized decision/evidence digest | Required |
| F4-029 | Security | Policy digest tampering | Integrity failure; no evaluation | Required |
| F4-030 | Security | Policy provenance tampering | Integrity failure; provenance not trusted automatically | Required |
| F4-031 | Security | Provider metadata attempts to widen scope | Local governance rejects widening | Required |
| F4-032 | Failure | Missing policy version | Typed `POLICY_NOT_FOUND` / deny boundary | Required |
| F4-033 | Failure | Ambiguous policy version | Typed `POLICY_AMBIGUOUS` and deny | Required |
| F4-034 | Failure | Provider incompatibility | Typed failure and deny/indeterminate outcome | Required |
| F4-035 | Failure | Provider invalid result | Typed failure and deny/indeterminate outcome | Required |
| F4-036 | Concurrency | Concurrent version registration | No conflicting replacement | Required |
| F4-037 | Concurrency | Concurrent activation | Deterministic lifecycle result | Required |
| F4-038 | Concurrency | Concurrent evaluation + retirement | Decision remains bound to exact resolved version | Required |
| F4-039 | Evidence | Decision record mutation attempt | Existing evidence remains immutable | Required |
| F4-040 | Integration | Federation requested capability + local policy | Final outcome follows local policy boundary | Required |

## Required Scenario Classes

1. deterministic policy canonicalization and digest tests;
2. lifecycle registry tests;
3. local default-deny/deny-overrides tests;
4. provider-neutral adapter tests with failure normalization;
5. provenance/reconstruction tests;
6. resource-bound tests;
7. federation/policy sovereignty tests;
8. concurrency and replay tests;
9. exact-candidate CI artifact/provenance verification.
