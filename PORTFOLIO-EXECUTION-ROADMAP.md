# SIF Portfolio Execution Roadmap

## Purpose

This document is the portfolio-level execution map for the Software Integration Foundation (SIF) and its consumers.

It separates:

- platform capabilities owned by SIF
- domain/business logic owned by consumer applications
- infrastructure/runtime ownership
- release and verification gates
- intentionally gated or unavailable work

The rule is simple:

> Build a capability once at the correct boundary, then consume it through a stable contract.

## 1. Canonical architecture

```text
                         SIF
                          |
          Stable platform/integration contracts
                          |
        +-----------------+------------------+
        |                 |                  |
        v                 v                  v
     Lara OS /          QADRIX         Sovereign Library
       REIE              / QRX              ecosystem
        |                 |                  |
        +-----------------+------------------+
                          |
                  Domain business logic
                          |
             +------------+------------+
             |            |            |
             v            v            v
         Supabase       Vercel       GitHub
```

SIF owns reusable integration boundaries.

Consumers own:

- product/domain entities
- business workflows
- decision rules
- user-facing behavior
- domain-specific persistence models
- product KPIs

## 2. Current portfolio state

| System | Role | Current state | Next action |
| --- | --- | --- | --- |
| SIF | Integration foundation | Adoption boundary implemented and covered by tests | Consume; do not rebuild |
| Lara OS / REIE | Real-estate intelligence consumer | Consumer repository is not present in the connected GitHub portfolio | Apply SIF boundary in the actual runtime source |
| QADRIX / QRX | Business operations consumer | Consumer repository is not present in the connected GitHub portfolio | Apply SIF contracts when source is available |
| Aqarat | Real-estate web/runtime surface | Production health verified; no open PR/issue | Keep stable; only change with evidence |
| Sadat MLS | Real-estate marketplace | Production health verified; adapter hardening merged | Keep stable; monitor runtime signals |
| Meta Operations Runtime | Reusable operations/agent runtime | Release engineering and core runtime qualification are substantially complete; deployment/live evidence remains explicitly separate | Continue only on evidence-backed deployment/live gates |
| Sovereign Library | Standalone library/product qualification | PR #125 intentionally remains open under governance | Finish exact-head verification, then follow authorization gate |
| Nabatatos / Ayar | Agricultural commerce surface | Production deployment responds successfully | Maintain; future work must be evidence-driven |
| Nabatos Agri Platform | Agricultural platform | Production deployment responds successfully | Maintain; future work must be evidence-driven |

## 3. SIF adoption contract

A consumer adoption must use this sequence:

```text
consumer intent
    ->
SIF capability contract
    ->
typed adapter / gateway
    ->
policy + authorization
    ->
consumer business rule
    ->
observable result
    ->
tests + CI
    ->
release
```

Do not:

- copy SIF internals into consumers
- duplicate policy engines
- create consumer-specific forks of the same integration primitive
- treat a passing unit test as live verification
- publish or enable side effects without the required authorization/evidence boundary

## 4. Definition of Done

A capability is complete only when all applicable layers are satisfied:

1. Contract
2. Implementation
3. Business logic
4. Persistence
5. Security / authorization
6. Error handling and recovery
7. Unit/conformance tests
8. Integration tests
9. CI
10. Deployment
11. Runtime verification
12. Documentation
13. Rollback/recovery path
14. Release state

A missing layer keeps the capability in the appropriate non-final state.

## 5. Release policy

Releases must be evidence-backed.

Green CI alone does not automatically mean:

- production-ready
- live-verified
- authorized for side effects
- authorized for external publication

For governed repositories, repository policy is the final gate.

## 6. Consumer execution order

### Wave A — Lara OS / REIE

Goal:

- install the SIF integration boundary
- map REIE domain events/operations to SIF contracts
- keep REIE entity resolution, crawling, research, opportunity logic, and business decisions in REIE
- verify browser/agent/operator boundaries separately
- establish production-safe adoption tests

Exit condition:

- real consumer code imports the intended SIF boundary
- no duplicated integration primitive remains
- tests prove the consumer contract
- runtime evidence proves the deployed behavior

### Wave B — QADRIX / QRX

Goal:

- consume the same stable SIF primitives
- keep workflow, CRM, sales stages, tasks, properties, roles, and business rules in QADRIX
- preserve future multi-tenant/RBAC boundaries
- verify multi-user behavior and failure recovery

Exit condition:

- real application path uses SIF contracts
- business logic remains consumer-owned
- database and authorization semantics are explicitly tested

### Wave C — Sovereign Library interoperability

Goal:

- use SIF patterns only where genuinely appropriate
- preserve Cube independence and standalone packaging
- never introduce SIF as an unwanted runtime dependency into standalone Cubes

Exit condition:

- interoperability is optional and explicit
- standalone qualification remains dependency-free
- governance and publication authorization remain intact

## 7. Stable-product rule

For already healthy deployed products:

- do not refactor for aesthetics
- do not redeploy without a reason
- do not replace working architecture with speculative architecture
- use runtime errors, failing tests, security findings, or measurable product requirements as change triggers

## 8. Open gates that are intentionally not auto-closed

Some gates require external evidence or explicit authorization:

- human-operated authenticated browser verification
- deployment-only database migration rehearsal
- independent penetration testing
- production backup/restore drill
- provider-specific live qualification
- controlled side effects
- external package publication
- governed release authorization

These are not "forgotten TODOs"; they are explicit evidence/authorization gates.

## 9. Portfolio operating loop

Every active repository follows:

```text
DISCOVER
  ->
RECONCILE
  ->
SPEC
  ->
IMPLEMENT
  ->
TEST
  ->
FIX
  ->
VERIFY
  ->
DEPLOY
  ->
OBSERVE
  ->
RELEASE / FREEZE
  ->
NEXT VERIFIED GAP
```

The next verified gap always outranks cosmetic or speculative work.

## 10. Final handoff target

The portfolio is considered operationally complete when:

- SIF is consumed rather than copied
- each consumer has a real adoption path
- business logic is explicit and testable
- production systems are healthy
- governed repositories have closed evidence gates
- release state matches the actual live state
- documentation no longer contradicts implementation
- no "unknown" is silently treated as "done"

---

## Current decision

SIF is now a **consumer-facing foundation**, not the next place for another broad rebuild.

The next engineering work belongs in the consumer runtime that can be verified from source. Where the source is unavailable in the connected environment, the state remains explicitly recorded rather than invented.
