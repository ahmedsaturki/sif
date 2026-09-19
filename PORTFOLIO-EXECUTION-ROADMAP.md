# SIF Portfolio Execution Roadmap

## Purpose

This is the portfolio source of truth for execution, verification, release, and handoff across SIF and the connected products.

Core rule:

> Build a capability once at the correct boundary, consume it through a stable contract, and prove every final claim with current evidence.

## 1. Canonical architecture

```text
                         SIF
                          |
          Stable platform / integration contracts
                          |
      +-------------------+----------------------+
      |                   |                      |
      v                   v                      v
   Lara OS /           QADRIX /            Sovereign Library
     REIE                 QRX                    |
      |                    |                     |
      +--------------------+---------------------+
                           |
                    Domain business logic
                           |
              +------------+-------------+
              |            |             |
              v            v             v
          Supabase       Vercel        GitHub
```

SIF owns reusable integration boundaries.

Consumers own:

- domain entities
- business workflows
- decision rules
- UX/API behavior
- domain persistence
- product KPIs
- customer-facing semantics

## 2. Current verified portfolio state — 2026-09-19

| System | Current verified state | Action |
| --- | --- | --- |
| SIF | Adoption boundary complete; tests and portfolio roadmap present on `main` | Freeze foundation; consume it |
| ai-team-v1 | PR #76 remains open at `5f642f72722a4c8cdcfd6f00081dbd3a10c3ffc2`; source hardening is present; repeated CI runs fail before runner allocation (`runner_id=0`, empty runner, zero steps) | Restore GitHub Actions runner admission before merge |
| Sovereign Library | `main` is `9e5267dc2b1d86350b529e1955c3993603ab3f5a`; PR #125/#128/#130/#131/#132 are merged; control-plane state and verified release inventory are reconciled | Maintain release/evidence truth; next Cube remains governance-gated |
| Aqarat | Production previously verified healthy; no open PR/issue in connected repo state | Keep stable; modify only on evidence |
| Sadat MLS | `main` is `b44325cf07f9451528874e0e24164a3123d4ba1f` after merged PR #16; live `/api/health` and `/en/explore` returned HTTP 200 on 2026-09-19; PR #17 documents source-vs-production state and is awaiting CI | Complete CI before merging documentation reconciliation |
| Nabatatos / Ayar | Production deployment verified responding successfully | Keep stable |
| Nabatos Agri Platform | Production deployment verified responding successfully | Keep stable |
| Meta Operations Runtime | PR #70 is open at `c39642fe8d0d7ee973d50a01b2f5d95266486f65` with guarded Facebook read-only capabilities; CI/Security Gate still fail before workflow step/runner execution (`runner_id=0`, zero steps) | Restore CI admission, then qualify live evidence before promotion |
| Lara OS / REIE | No direct connected source repo found | Do not invent implementation; integrate when source is actually connected |
| QADRIX / QRX | No direct connected source repo found | Do not invent implementation; integrate when source is actually connected |

## 2A. Verified release inventory signal — 2026-09-19

Sovereign Library currently reports 74 published, non-draft, non-prerelease GitHub Release objects. Eight have uploaded `.tgz` assets; 66 have no release assets. The first two authorized candidates are asset-backed. A Release object without an uploaded artifact is not treated as complete package-distribution evidence.

## 3. ai-team-v1 current-main execution state

The active consolidation is **PR #76**:

- Head branch: `feat/current-main-integration-wave`
- Latest observed head: `2550250da1da3e80076809fd0d5bca3fd2dc8562`
- Base: `main` at `436eba05bd876ff54bf2c19fd1407b3759725b65`
- Semgrep: successful
- Build check: repeatedly failing before useful job execution on the current workflow path; retries produced immediate workflow failure without actionable job steps/logs

The wave contains the current-main versions of:

- Project OS
- Delivery OS
- Enterprise CRM
- Enterprise MLS
- Enterprise Workforce Runtime hardening
- platform RFC / architecture / release governance artifacts
- reconciled workspace dependency entries

The wave deliberately excludes the old simulated vertical-workforce scaffold.

### ai-team-v1 business-logic hardening completed in the wave

**Project OS**
- execution is adapter-backed
- no adapter means no execution
- evidence and artifacts come from the adapter
- successful execution ends in review
- approval is explicit
- delivery no longer creates implicit approval

**Delivery OS**
- dashboard health now derives from the customer-health calculation instead of fixed 0.8/0.3 constants

**Workforce Runtime**
- execution requires an injected adapter
- terminal results are explicit `completed` / `failed`
- request identity is required in execution results
- approval is independent from completion
- worker metrics and evidence remain tied to actual execution results

**MLS**
- domain-rich implementation was promoted into the integration wave
- property, tenancy, deal, offer, matching, price-history, and decision-support concepts are represented in the richer domain model
- decision-support naming is descriptive rather than claiming an actual model where the implementation is deterministic

## 4. Sovereign Library current state

PR #125 is merged. Current `main` is `eb1a2e52f106f14b351e9575119413a19a15398a`; PR #130 is the active release-state documentation reconciliation.

Latest merged main head:

`eb1a2e52f106f14b351e9575119413a19a15398a`

Verified current-head workflows include successful:

- Python ports
- phase3 hardening
- verify
- release engineering
- Kotlin/JVM
- Node multi-platform
- multi-region checks
- performance checks
- E2E checks
- chaos probes
- load checks
- SBOM/licensing/API/backward-compatibility plans

Android was still running in the latest observed check snapshot and had also produced prior successful completed runs.

Release-state status is **under reconciliation**:

- PR #125's exact-head security/verification wave completed successfully before merge.
- PR #130 has successful security-pipeline, phase3, and verify runs; one release-engineering macOS job remained queued during the latest poll.
- The verified release inventory is 74 published GitHub Release objects, 8 with uploaded `.tgz` assets and 66 without assets.

Therefore:

> Release objects and artifact-backed distribution are tracked separately; external ecosystem publication remains a distinct gate.

## 5. SIF adoption contract

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

Never:

- copy SIF internals into consumers
- duplicate integration primitives
- silently replace a live dependency with a guessed implementation
- treat unit-test success as live verification
- claim external publication without publication evidence

## 6. Definition of Done

A capability is final only when applicable layers are all evidenced:

1. Contract
2. Implementation
3. Business logic
4. Persistence
5. Security / authorization
6. Error handling / recovery
7. Unit / conformance tests
8. Integration tests
9. CI
10. Deployment
11. Runtime verification
12. Documentation
13. Rollback / recovery
14. Release state

A missing layer keeps the item in a non-final state.

## 7. Product stability rule

Healthy production products are changed only when there is evidence:

- runtime error
- failing test
- security issue
- broken business rule
- measurable product requirement
- verified deployment issue

No aesthetic refactors or architecture replacement merely to consume time.

## 8. Consumer waves

### Wave A — Lara OS / REIE

Required when the source repository is connected:

- adopt SIF boundary
- keep crawler/browser/entity-resolution/opportunity/business logic in REIE
- prove authenticated browser/operator boundaries
- establish integration and runtime evidence

### Wave B — QADRIX / QRX

Required when the source repository is connected:

- consume SIF contracts
- keep CRM/property/stage/task/RBAC logic in QADRIX
- preserve multi-user and future multi-tenant semantics
- verify failure recovery

### Wave C — Sovereign interoperability

- interoperability is optional
- Cubes remain standalone and dependency-free
- SIF cannot become an accidental runtime dependency of standalone Cubes

## 9. Intentional external gates

These are explicit evidence or authorization gates, not forgotten TODOs:

- human authenticated browser verification
- production database migration rehearsal
- independent penetration testing
- backup / restore drill
- provider-specific live qualification
- controlled external side effects
- external package publication
- governed release authorization

## 10. Portfolio operating loop

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

## 11. Final handoff criteria

Portfolio handoff is complete when:

- SIF is consumed instead of copied
- every connected consumer has a real adoption path
- business logic is explicit and tested
- production surfaces are verified
- governed repositories have closed evidence gates
- release state matches actual live state
- documentation matches implementation
- no unknown is silently treated as done
- stale PRs and conflicting branches no longer represent active work

## 12. Current decision

SIF is frozen as a reusable foundation.

The active engineering focus is now consumer/product completion and evidence closure, not another SIF rebuild.

For any repository whose source is not connected, the correct state is recorded explicitly rather than fabricated.
