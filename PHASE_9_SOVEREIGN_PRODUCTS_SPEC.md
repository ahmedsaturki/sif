# Phase 9 — Sovereign Products Specification

## Purpose
Expose selected verified SIF planes through explicit, versioned, product-facing adapters without coupling SIF Core to application internals.

## Products
- `LARA_OS_REIE`: Lara OS / REIE integration boundary.
- `QADRIX`: QADRIX integration boundary.
- `SOVEREIGN_LIBRARY`: Sovereign Library integration boundary.

These adapters are protocol boundaries, not application implementations. They do not claim live deployment, network access, database access, browser control, or automatic publication.

## Invariants
1. Every adapter has an immutable descriptor containing product identity, adapter version, protocol version, capabilities, allowed operations, and authority scopes.
2. Every request is normalized before execution and receives a deterministic request digest.
3. Requested capabilities must be explicitly exposed by the adapter.
4. Requested authority scopes must be a subset of adapter authority; capability-required scopes must also be present.
5. Adapter/version/product mismatches fail closed.
6. Undeclared operations fail closed.
7. Missing handlers are `UNAVAILABLE`; handler failures are `INDETERMINATE`; invalid authorization/input is `FAIL`.
8. Adapter execution does not perform hidden external I/O; application-specific work is supplied through explicit injected handlers.
9. Results bind product, adapter version, operation, request digest, capabilities, authority, evidence references, and a deterministic response digest.
10. Caller-owned input and output objects are cloned at the boundary.
11. Product evidence is append-only, bounded, hash-linked, and verifiable.
12. Replay verification fails closed when either request or recorded response identity changes.
13. Registry registration is unique by product identity and bounded by resource limits.
14. No adapter can widen authority beyond its descriptor, and no request can smuggle additional authority through payload data.

## Non-goals
No direct integrations with Lara OS/REIE, QADRIX, Sovereign Library, Supabase, PostgreSQL, GitHub, browsers, queues, or external APIs are claimed by this phase.

## Acceptance
The phase is complete only when the implementation compiles, executable F9-001..F9-060 coverage passes, exact-head CI passes all gates, and an unpublished candidate artifact is produced and verified.
