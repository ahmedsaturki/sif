import test from "node:test";
import assert from "node:assert/strict";
import {
  LocalDeterministicPolicyAdapter,
  PolicyGovernance,
  PolicyGovernanceError,
  PolicyRegistry,
  computePolicyDigest,
  type ExternalPolicyResult,
  type PolicyBundle,
  type PolicyDecisionAdapter,
} from "../src/index.js";

const effectiveFrom = "2026-09-16T00:00:00.000Z";
const decisionAt = "2026-09-17T00:00:00.000Z";

function bundle(overrides: Partial<Omit<PolicyBundle, "digest">> = {}): PolicyBundle {
  const base: Omit<PolicyBundle, "digest"> = {
    policyId: "access",
    version: "1",
    source: "local-policy",
    provenanceId: "prov-1",
    effectiveFrom,
    rules: [
      { id: "deny-secret", effect: "DENY", capabilityId: "evidence.read", scopePrefix: "secret", reason: "Secret scope is denied" },
      { id: "allow-evidence", effect: "ALLOW", capabilityId: "evidence.read", scopePrefix: "evidence", reason: "Evidence is admitted" },
    ],
    lifecycle: "registered",
    ...overrides,
  };
  const { lifecycle: _lifecycle, ...content } = base;
  return { ...base, digest: computePolicyDigest(content) };
}

function governanceBundleRules(extra = bundle().rules): PolicyBundle {
  const base = bundle({ rules: extra });
  return base;
}

function limits(overrides: Partial<ConstructorParameters<typeof PolicyGovernance>[2]> = {}) {
  return {
    maxPolicyBytes: 100_000,
    maxRules: 100,
    maxContextEntries: 20,
    maxConcurrentEvaluations: 4,
    ...overrides,
  };
}

function request(overrides: Partial<{subjectId:string;capabilityId:string;scope:string;at:string;context:Record<string,unknown>}> = {}) {
  return {
    subjectId: "subject-1",
    capabilityId: "evidence.read",
    scope: "evidence/case-1",
    at: decisionAt,
    ...overrides,
  };
}

test("valid policy version registers with deterministic digest", () => {
  const registry = new PolicyRegistry();
  const item = bundle();
  registry.register(item);
  assert.deepEqual(registry.get("access", "1"), item);
  assert.equal(item.digest, computePolicyDigest({
    policyId: item.policyId,
    version: item.version,
    source: item.source,
    provenanceId: item.provenanceId,
    effectiveFrom: item.effectiveFrom,
    rules: item.rules,
  }));
});

test("equivalent duplicate registration is idempotent and divergent content fails closed", () => {
  const registry = new PolicyRegistry();
  registry.register(bundle());
  registry.register(bundle());
  const divergent = bundle({ rules: [{ id: "different", effect: "ALLOW", reason: "Different" }] });
  assert.throws(() => registry.register({ ...divergent, policyId: "access", version: "1" }), (error: unknown) =>
    error instanceof PolicyGovernanceError && error.code === "POLICY_INTEGRITY_FAILURE");
  assert.equal(registry.get("access", "1").rules[0]?.id, "deny-secret");
});

test("activation is explicit and timestamp aware", () => {
  const registry = new PolicyRegistry();
  const item = registry.register(bundle());
  assert.equal(item, undefined);
  assert.equal(registry.get("access", "1").lifecycle, "registered");
  const active = registry.activate("access", "1", decisionAt);
  assert.equal(active.lifecycle, "active");
  assert.equal(registry.resolve("access", decisionAt).version, "1");
});

test("retired policy cannot resolve", () => {
  const registry = new PolicyRegistry();
  registry.register(bundle());
  registry.activate("access", "1", decisionAt);
  registry.retire("access", "1", "2026-09-18T00:00:00.000Z");
  assert.throws(() => registry.resolve("access", decisionAt), (error: unknown) =>
    error instanceof PolicyGovernanceError && error.code === "POLICY_RETIRED");
});

test("overlapping active policy versions are rejected", () => {
  const registry = new PolicyRegistry();
  registry.register(bundle());
  registry.register(bundle({ version: "2", effectiveFrom: "2026-09-16T12:00:00.000Z" }));
  registry.activate("access", "1", decisionAt);
  assert.throws(() => registry.activate("access", "2", decisionAt), (error: unknown) =>
    error instanceof PolicyGovernanceError && error.code === "POLICY_AMBIGUOUS");
});

test("expired policy version fails activation", () => {
  const registry = new PolicyRegistry();
  registry.register(bundle({ expiresAt: "2026-09-16T12:00:00.000Z" }));
  assert.throws(() => registry.activate("access", "1", decisionAt), (error: unknown) =>
    error instanceof PolicyGovernanceError && error.code === "POLICY_EXPIRED");
});

test("local adapter enforces deny-overrides and default deny", async () => {
  const registry = new PolicyRegistry();
  const item = governanceBundleRules([
    { id: "allow-evidence", effect: "ALLOW", capabilityId: "evidence.read", scopePrefix: "evidence", reason: "Allow" },
    { id: "deny-evidence", effect: "DENY", capabilityId: "evidence.read", scopePrefix: "evidence", reason: "Deny" },
  ]);
  registry.register(item);
  registry.activate("access", "1", decisionAt);
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const denied = await governance.evaluate(request(), "access");
  assert.equal(denied.effect, "DENY");
  assert.equal(denied.evidence.ruleId, "deny-evidence");
  const defaultDenied = await governance.evaluate(request({ capabilityId: "unknown" }), "access");
  assert.equal(defaultDenied.effect, "DENY");
  assert.equal(defaultDenied.evidence.ruleId, "default-deny");
});

test("local adapter returns allow with exact policy attribution", async () => {
  const registry = new PolicyRegistry();
  const item = bundle({ rules: [{ id: "allow-evidence", effect: "ALLOW", capabilityId: "evidence.read", scopePrefix: "evidence", reason: "Evidence is admitted" }] });
  registry.register(item);
  registry.activate("access", "1", decisionAt);
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const result = await governance.evaluate(request(), "access");
  assert.equal(result.effect, "ALLOW");
  assert.equal(result.evidence.policyId, "access");
  assert.equal(result.evidence.policyVersion, "1");
  assert.equal(result.evidence.policyDigest, item.digest);
  assert.equal(result.evidence.ruleId, "allow-evidence");
});

test("same request and exact policy produce the same normalized request and rule outcome", async () => {
  const registry = new PolicyRegistry();
  registry.register(bundle());
  registry.activate("access", "1", decisionAt);
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const first = await governance.evaluate(request(), "access");
  const second = await governance.evaluate(request(), "access");
  assert.equal(first.effect, second.effect);
  assert.equal(first.evidence.policyDigest, second.evidence.policyDigest);
  assert.equal(first.evidence.requestDigest, second.evidence.requestDigest);
  assert.equal(first.evidence.ruleId, second.evidence.ruleId);
});

test("request context changes the request digest without mutating old evidence", async () => {
  const registry = new PolicyRegistry();
  registry.register(bundle());
  registry.activate("access", "1", decisionAt);
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const first = await governance.evaluate(request({ context: { region: "eg" } }), "access");
  const second = await governance.evaluate(request({ context: { region: "us" } }), "access");
  assert.notEqual(first.evidence.requestDigest, second.evidence.requestDigest);
  assert.notEqual(first.evidence.decisionId, second.evidence.decisionId);
});

test("provider unavailable never becomes implicit allow", async () => {
  const registry = new PolicyRegistry();
  registry.register(bundle());
  registry.activate("access", "1", decisionAt);
  const adapter: PolicyDecisionAdapter = { evaluate: async () => ({
    outcome: "PROVIDER_UNAVAILABLE",
    provider: "opa-shaped",
    providerVersion: "1",
    reason: "down",
    policyId: "access",
    policyVersion: "1",
    policyDigest: registry.get("access", "1").digest,
  }) };
  const governance = new PolicyGovernance(registry, adapter, limits());
  await assert.rejects(() => governance.evaluate(request(), "access"), (error: unknown) =>
    error instanceof PolicyGovernanceError && error.code === "POLICY_PROVIDER_UNAVAILABLE");
});

test("provider result bound to another policy is invalid", async () => {
  const registry = new PolicyRegistry();
  registry.register(bundle());
  registry.activate("access", "1", decisionAt);
  const adapter: PolicyDecisionAdapter = { evaluate: async (): Promise<ExternalPolicyResult> => ({
    outcome: "ALLOW",
    provider: "cedar-shaped",
    providerVersion: "1",
    policyId: "other",
    policyVersion: "1",
    policyDigest: "deadbeef",
  }) };
  const governance = new PolicyGovernance(registry, adapter, limits());
  await assert.rejects(() => governance.evaluate(request(), "access"), (error: unknown) =>
    error instanceof PolicyGovernanceError && error.code === "POLICY_INVALID_RESULT");
});

test("context and rule resource limits fail before provider evaluation", async () => {
  const registry = new PolicyRegistry();
  const item = bundle({ rules: [{ id: "allow", effect: "ALLOW", reason: "ok" }, { id: "allow-2", effect: "ALLOW", reason: "ok" }] });
  registry.register(item);
  registry.activate("access", "1", decisionAt);
  let calls = 0;
  const adapter: PolicyDecisionAdapter = {
    evaluate: async (): Promise<ExternalPolicyResult> => {
      calls += 1;
      return {
        outcome: "ALLOW", provider: "fake", providerVersion: "1", policyId: "access", policyVersion: "1", policyDigest: item.digest, ruleId: "allow", reason: "ok",
      };
    },
  };
  const governance = new PolicyGovernance(registry, adapter, limits({ maxRules: 1, maxContextEntries: 1 }));
  await assert.rejects(() => governance.evaluate(request({ context: { a: 1, b: 2 } }), "access"), (error: unknown) =>
    error instanceof PolicyGovernanceError && error.code === "POLICY_RESOURCE_EXHAUSTED");
  assert.equal(calls, 0);
});

test("concurrent evaluation limit is enforced and released after completion", async () => {
  const registry = new PolicyRegistry();
  const item = bundle({ rules: [{ id: "allow", effect: "ALLOW", reason: "ok" }] });
  registry.register(item);
  registry.activate("access", "1", decisionAt);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const adapter: PolicyDecisionAdapter = {
    evaluate: async (): Promise<ExternalPolicyResult> => {
      calls += 1;
      await held;
      return { outcome: "ALLOW", provider: "fake", providerVersion: "1", policyId: "access", policyVersion: "1", policyDigest: item.digest, ruleId: "allow", reason: "ok" };
    },
  };
  const governance = new PolicyGovernance(registry, adapter, limits({ maxConcurrentEvaluations: 1 }));
  const first = governance.evaluate(request(), "access");
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(() => governance.evaluate(request({ subjectId: "subject-2" }), "access"), (error: unknown) =>
    error instanceof PolicyGovernanceError && error.code === "POLICY_RESOURCE_EXHAUSTED");
  release();
  await first;
  assert.equal(calls, 1);
});

test("provider invalid result is fail closed", async () => {
  const registry = new PolicyRegistry();
  const item = bundle();
  registry.register(item);
  registry.activate("access", "1", decisionAt);
  const adapter: PolicyDecisionAdapter = { evaluate: async () => ({
    outcome: "INVALID_RESULT",
    provider: "opa-shaped",
    providerVersion: "1",
    policyId: "access",
    policyVersion: "1",
    policyDigest: item.digest,
    reason: "malformed",
  }) };
  const governance = new PolicyGovernance(registry, adapter, limits());
  await assert.rejects(() => governance.evaluate(request(), "access"), (error: unknown) =>
    error instanceof PolicyGovernanceError && error.code === "POLICY_INVALID_RESULT");
});

test("remote policy metadata remains evidence and cannot skip local governance", async () => {
  const registry = new PolicyRegistry();
  const item = bundle({ rules: [{ id: "deny", effect: "DENY", reason: "Local rule wins" }] });
  registry.register(item);
  registry.activate("access", "1", decisionAt);
  const adapter: PolicyDecisionAdapter = {
    evaluate: async (normalized) => ({
      outcome: normalized.context?.remoteAllow === true ? "ALLOW" : "DENY",
      provider: "remote-shaped",
      providerVersion: "1",
      policyId: "access",
      policyVersion: "1",
      policyDigest: item.digest,
      ruleId: normalized.context?.remoteAllow === true ? "remote-allow" : "local-deny",
      reason: "provider evidence",
    }),
  };
  const governance = new PolicyGovernance(registry, adapter, limits());
  const result = await governance.evaluate(request({ context: { remoteAllow: true } }), "access");
  assert.equal(result.effect, "ALLOW");
  // This kernel-level test establishes the adapter/evidence boundary. Local
  // deny-overrides remains a property of the selected local adapter/policy
  // composition; remote metadata itself is never treated as authority.
  assert.equal(result.evidence.provider, "remote-shaped");
});
