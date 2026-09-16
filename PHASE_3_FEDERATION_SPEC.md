# SIF Phase 3 — Secure Federation Specification

## Status
SPEC ONLY — no Phase 3 runtime capability is claimed by this document.

Phase 2 (Live PostgreSQL 0.6) remains an unpublished verification candidate. Phase 3 must not be treated as implemented until code, tests, fault tests, evidence, and promotion gates are complete.

## Objective
Define a sovereignty-preserving federation boundary that allows independent SIF domains to exchange authenticated messages and evidence without silently transferring remote authority into the local domain.

## Non-Goals
- No distributed consensus.
- No assumption of shared trust merely because a transport is encrypted.
- No automatic delegation of local authority from a remote domain.
- No exactly-once external side effects.
- No production-scale HA/performance claim.
- No replacement of immutable local event history with remote state.

## Required Capability Areas

### 1. Transport Identity
- TLS-based authenticated transport boundary.
- SPIFFE-compatible workload identity representation at the adapter boundary.
- Explicit trust-bundle configuration and rotation model.
- Peer identity must be cryptographically bound to the authenticated transport session.

### 2. Federation Envelope
Every accepted federated message must carry enough information to establish:
- protocol/schema identity and version;
- sender domain identity;
- message identity;
- event/evidence identity when applicable;
- creation/occurrence metadata with declared time semantics;
- provenance reference;
- integrity/signature material;
- replay-protection material;
- capability/authorization context required for local admission.

The envelope must distinguish MESSAGE IDENTITY from EVENT IDENTITY.

### 3. Capability Negotiation
- Explicit protocol and capability negotiation.
- Compatibility is both syntactic and semantic; schema compatibility alone is insufficient.
- Unknown or unsupported capabilities fail closed.
- Negotiated capabilities are scoped to the peer/session/protocol version and are not persistent authority.

### 4. Signed Federated Messages
- Verify signature before semantic admission.
- Bind the authenticated sender identity to signed content and declared provenance.
- Detect message replay and duplicate delivery using durable identities.
- Preserve the original signed evidence; local interpretation must be versioned rather than mutating remote history.

### 5. Local Sovereignty / Authority Boundary
- Remote evidence may become admissible local evidence only through an explicit local admission policy.
- Remote signatures/trust/domain membership do not create local permission.
- Any local authority derived from remote assertions must be separately scoped, time-bounded, and attributable to a local authorization decision.
- Remote commands must never execute solely because the remote sender is trusted.

### 6. Replay-Safe Reconciliation
- Reconciliation must be deterministic within its declared scope.
- Duplicate, delayed, reordered, and replayed messages must be safe to process.
- Reconciliation must preserve immutable local event history.
- Remote state cannot overwrite local authoritative history.
- Conflicting observations must become explicit evidence/conflict records rather than silent mutation.

### 7. Failure Semantics
The federation layer must distinguish at minimum:
- unavailable peer;
- authentication failure;
- authorization denial;
- schema/protocol incompatibility;
- replay/duplicate;
- invalid signature/integrity failure;
- unknown outcome;
- transient delivery failure.

Retry is permitted only when the operation is idempotent and retry admission is satisfied.

## Security Invariants
1. No unauthenticated peer is admitted.
2. No invalid signature is admitted.
3. No remote authority is silently converted into local authority.
4. No message identity is reused to represent a distinct event identity.
5. No replayed message may create a duplicate committed effect where idempotency is required.
6. No incompatible protocol/capability is silently downgraded.
7. No remote evidence can mutate immutable local history.
8. Trust, provenance, signature, and authorization remain distinct concepts.

## Verification Plan
Phase 3 implementation is not promotable until CI demonstrates, at minimum:
- authenticated peer identity verification;
- trust-bundle acceptance/rejection;
- message signature verification and tamper detection;
- replay/duplicate rejection or idempotent handling;
- capability negotiation success and fail-closed incompatibility;
- local authorization boundary tests;
- ordered/unordered delivery characterization;
- retry/idempotency tests;
- delayed-message and reconciliation tests;
- peer outage and recovery characterization;
- evidence/artifact provenance bound to the exact candidate checkout.

Fault-injection tests must explicitly confirm that each claimed fault scenario actually occurred before the result is recorded as verified.

## Promotion Boundary
This specification creates the Phase 3 work boundary only. It does not authorize implementation, publication, or merge by itself. Implementation should occur on a dedicated branch derived from the preserved verified baseline/candidate according to the repository release discipline:

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

## Open Engineering Questions
- Exact SPIFFE integration strategy without coupling the dependency-free kernel to a mandatory runtime.
- Trust-bundle representation, rotation, and revocation semantics.
- Wire protocol selection and canonical envelope schema.
- Whether reconciliation is event exchange, evidence exchange, state-diff exchange, or a constrained combination.
- Durable inbox and peer cursor design for federated streams.
- Federation-specific admission policy adapter contract.
- Exact replay window and retention semantics.
- Resource bounds and backpressure behavior under peer retry storms.
