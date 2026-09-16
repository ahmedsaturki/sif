# SIF Phase 4 — Policy & Governance Specification

## Status
SPEC ONLY — Phase 4 runtime capability is not claimed by this document.

Phase 4 builds on the verified Secure Federation boundary without changing SIF's sovereignty, integrity, provenance, or fail-closed laws.

## Objective
Establish a versioned, attributable, provenance-bound policy and governance plane that can evaluate local authorization decisions through provider-neutral adapters without making an external policy engine authoritative over SIF history or identity.

## Non-Goals
- No mandatory OPA or Cedar runtime dependency in `sif-core`.
- No remote policy source becomes authoritative merely because it is trusted or signed.
- No policy engine may mutate immutable event history.
- No authorization decision is valid without explicit subject, capability, scope, policy-version, time and provenance context.
- No hidden policy fallback from a failed external adapter to an allow decision.
- No unbounded policy evaluation or uncontrolled policy bundle growth.

## Required Capability Areas

### 1. Policy Bundle Identity
Every policy bundle must have:
- stable policy id;
- immutable version identity;
- source/provenance reference;
- effective-from timestamp;
- optional expiry timestamp;
- deterministic content digest;
- explicit lifecycle state.

A registered version is immutable. Replacing policy content requires a new version.

### 2. Policy Registry and Lifecycle
The registry must support:
- registration of immutable versions;
- explicit activation;
- explicit retirement;
- deterministic resolution for an evaluation timestamp;
- rejection of overlapping active versions for the same policy id unless an explicit selector disambiguates them;
- audit/provenance linkage for lifecycle changes.

Configured, active, evaluable, and production-approved are distinct states.

### 3. Authorization Request
A policy evaluation request must bind:
- subject identity;
- capability id;
- scope;
- evaluation timestamp;
- resource/effect context;
- policy id/version selection semantics;
- provenance/context digest where supplied.

Remote assertions, federation trust and cryptographic provenance may be inputs, but they do not create local permission by themselves.

### 4. Provider-Neutral Decision Adapter
The kernel must expose an adapter boundary for external policy systems such as OPA or Cedar without requiring either runtime.

The adapter contract must:
- accept a normalized request;
- return a normalized allow/deny/unknown result;
- identify the evaluated policy version;
- preserve provider decision metadata as attributable evidence;
- fail closed when the provider is unavailable, malformed, incompatible, or returns an unusable result.

### 5. Decision Evidence
Every accepted or denied evaluation should preserve:
- decision identity;
- policy id/version;
- rule/provider decision identity;
- request identity/digest;
- decision time and validity window;
- final effect;
- provider/runtime metadata;
- local admission context.

An external provider result is evidence for a local decision, not the local decision's authority source.

### 6. Governance Constraints
Governance must support:
- deny-overrides semantics at the local boundary;
- explicit default-deny behavior;
- bounded evaluation context size;
- bounded policy version retention;
- deterministic lifecycle transitions;
- reproducible decision evidence;
- fail-closed behavior on missing or ambiguous policy versions.

### 7. Federation Interaction
Federation remains subordinate to local policy:
- authenticated remote peers still require local policy evaluation;
- negotiated capability does not bypass local policy;
- remote policy assertions are evidence only;
- local authorization decisions remain attributable to a local policy version and evaluation context.

## Security Invariants
1. Policy content is immutable after registration.
2. A decision identifies the exact policy version evaluated.
3. External provider failure cannot become an implicit allow.
4. Remote trust does not create local policy authority.
5. Policy provenance does not replace cryptographic or identity checks.
6. Expired/retired policy cannot be silently used for current authorization.
7. Ambiguous policy resolution fails closed.
8. Authorization evidence is reconstructable from the recorded request/policy identities.

## Verification Plan
Phase 4 implementation is not promotable until CI demonstrates:
- immutable policy version registration;
- explicit lifecycle activation/retirement;
- deterministic timestamp-aware resolution;
- provider-neutral decision normalization;
- OPA/Cedar-shaped compatibility behavior without mandatory runtime dependencies;
- default-deny and deny-overrides behavior;
- provider failure and malformed-result fail-closed behavior;
- decision provenance and exact policy-version attribution;
- policy/evaluation resource bounds;
- federation-to-policy sovereignty preservation;
- deterministic decision replay.

## Promotion Boundary
This specification defines the next implementation boundary only. Phase 4 must follow:

`SPEC → CONTRACT → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
