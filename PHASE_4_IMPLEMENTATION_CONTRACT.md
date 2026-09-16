# SIF Phase 4 — Policy & Governance Implementation Contract

## Status
IMPLEMENTATION CONTRACT — implementation must satisfy this boundary before promotion.

## Source Laws
Phase 4 preserves:
- immutable local event history is authoritative;
- remote trust does not create local authority;
- authorization is explicit, scoped and attributable;
- evidence identifies exact content and runtime context;
- configured != active != evaluable != production-safe;
- failure and UNKNOWN/indeterminate outcomes are distinct from allow;
- dependency-free kernel boundaries remain provider-neutral.

## P1 — Policy Bundle Model

### Required interface concepts
`PolicyBundle`, `PolicyRule`, `PolicyBundleDigest`, lifecycle state, effective/expiry times, provenance reference.

### Invariants
- stable `policyId` plus immutable `version` identifies content;
- the digest is computed from deterministic canonical policy content;
- invalid dates, empty identities, duplicate rules, or malformed content fail closed;
- source and provenance are retained but do not grant authorization.

## P2 — Policy Registry

Responsibilities:
- register immutable versions;
- activate one unambiguous version for a policy id/time scope;
- retire versions explicitly;
- resolve the applicable version deterministically for a request timestamp;
- reject ambiguous or missing resolution.

Registry lifecycle must be append-safe: duplicate version registration with different content is an integrity failure, not replacement.

## P3 — Authorization Request / Decision

### Request
Must contain normalized subject, capability, scope, evaluation time and deterministic context identity.

### Decision
Must contain:
- decision id;
- effect `ALLOW | DENY | INDETERMINATE`;
- policy id/version;
- rule/provider decision reference;
- request digest;
- evaluation time;
- optional bounded validity window;
- attributable reason/evidence.

`INDETERMINATE` never becomes implicit allow.

## P4 — External Policy Adapter

```ts
interface PolicyDecisionAdapter {
  evaluate(request: NormalizedPolicyRequest, bundle: PolicyBundle): Promise<ExternalPolicyResult>;
}
```

Adapters for OPA/Cedar-shaped inputs are provider-neutral and optional. The kernel must not require their packages.

Provider results must be normalized from:
- ALLOW;
- DENY;
- INDETERMINATE;
- INVALID_RESULT;
- PROVIDER_UNAVAILABLE;
- PROVIDER_INCOMPATIBLE.

Only a validated explicit ALLOW may produce a local ALLOW decision, and only after local governance checks.

## P5 — Local Governance Boundary

The governance layer must:
1. resolve the exact local policy version;
2. validate request/resource bounds;
3. evaluate the configured provider/engine;
4. apply local deny-overrides/default-deny semantics;
5. emit a durable attributable decision record.

Remote federation metadata may be retained in request context but cannot widen the local decision.

## P6 — Resource / Abuse Boundaries

Implement explicit positive safe-integer limits for:
- policy document size;
- rule count;
- context entries/bytes;
- retained versions;
- evaluation concurrency;
- provider evaluation time/cancellation boundary where the host can enforce it.

Resource exhaustion fails closed and is attributable.

## P7 — Evidence / Provenance

Decision evidence must be sufficient to reconstruct:
- exact policy id/version/digest;
- normalized request digest;
- provider type/version metadata;
- rule/provider decision reference;
- decision effect and evaluation time;
- local governance outcome.

Evidence records must be immutable from the caller's perspective.

## P8 — Federation Integration

A federated message may carry a requested capability, but final authorization must pass the local Phase 4 governance boundary. Negotiated federation capabilities, peer trust and remote policy assertions are inputs/evidence only.

## Typed Failure Contract
At minimum distinguish:
- `POLICY_NOT_FOUND`
- `POLICY_AMBIGUOUS`
- `POLICY_EXPIRED`
- `POLICY_RETIRED`
- `POLICY_INVALID`
- `POLICY_INTEGRITY_FAILURE`
- `POLICY_PROVIDER_UNAVAILABLE`
- `POLICY_PROVIDER_INCOMPATIBLE`
- `POLICY_INVALID_RESULT`
- `POLICY_RESOURCE_EXHAUSTED`
- `POLICY_DENIED`

## Promotion Gates
Promotion requires all contract tests to pass, no unknown mandatory policy behavior, deterministic decision evidence, and no release metadata changes without a separate release boundary.
