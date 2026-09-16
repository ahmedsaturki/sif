import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryPolicyDecisionLedger,
  LocalDeterministicPolicyAdapter,
  PolicyGovernance,
  PolicyGovernanceError,
  PolicyRegistry,
  computePolicyDigest,
  normalizePolicyRequest,
  type ExternalPolicyResult,
  type PolicyBundle,
  type PolicyDecisionAdapter,
} from "../src/index.js";

const t0 = "2026-09-16T00:00:00.000Z";
const t1 = "2026-09-17T00:00:00.000Z";
const t2 = "2026-09-18T00:00:00.000Z";

function makeBundle(overrides: Partial<PolicyBundle> = {}): PolicyBundle {
  const base: Omit<PolicyBundle, "digest"> = {
    policyId: "access",
    version: "1",
    source: "local",
    provenanceId: "prov-1",
    effectiveFrom: t0,
    expiresAt: t2,
    rules: [
      { id: "allow-evidence", effect: "ALLOW", capabilityId: "evidence.read", scopePrefix: "evidence", reason: "Evidence is allowed" },
      { id: "deny-secret", effect: "DENY", capabilityId: "evidence.read", scopePrefix: "evidence/secret", reason: "Secret evidence is denied" },
    ],
    lifecycle: "registered",
    ...overrides,
  };
  const { digest: _ignored, lifecycle: _lifecycle, ...content } = base as PolicyBundle;
  return { ...base, digest: computePolicyDigest(content) };
}

function limits(overrides: Partial<ConstructorParameters<typeof PolicyGovernance>[2]> = {}) {
  return {
    maxPolicyBytes: 100_000,
    maxRules: 100,
    maxContextEntries: 20,
    maxContextBytes: 10_000,
    maxVersionsPerPolicy: 10,
    maxConcurrentEvaluations: 2,
    ...overrides,
  };
}

function req(overrides: Partial<{ subjectId: string; capabilityId: string; scope: string; at: string; context: Record<string, unknown> }> = {}) {
  return {
    subjectId: "subject-1",
    capabilityId: "evidence.read",
    scope: "evidence/case-1",
    at: t1,
    ...overrides,
  };
}

function activate(registry: PolicyRegistry, item = makeBundle()): PolicyBundle {
  registry.register(item);
  return registry.activate(item.policyId, item.version, t1);
}

test("F4-001 valid policy version registers with deterministic digest", () => {
  const registry = new PolicyRegistry();
  const item = makeBundle();
  registry.register(item);
  assert.deepEqual(registry.get("access", "1"), item);
  assert.equal(item.digest, computePolicyDigest({ policyId: item.policyId, version: item.version, source: item.source, provenanceId: item.provenanceId, effectiveFrom: item.effectiveFrom, expiresAt: item.expiresAt, rules: item.rules }));
});

test("F4-002 duplicate identical version registration is idempotent", () => {
  const registry = new PolicyRegistry();
  const item = makeBundle();
  registry.register(item);
  registry.register(item);
  assert.equal(registry.list("access").length, 1);
});

test("F4-003 duplicate divergent version fails integrity and preserves original", () => {
  const registry = new PolicyRegistry();
  const item = makeBundle();
  registry.register(item);
  const divergent = makeBundle({ rules: [{ id: "different", effect: "ALLOW", reason: "Different" }] });
  assert.throws(() => registry.register(divergent), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_INTEGRITY_FAILURE");
  assert.equal(registry.get("access", "1").rules[0]?.id, "allow-evidence");
});

test("F4-004 malformed policy content fails closed", () => {
  const registry = new PolicyRegistry();
  const invalid = makeBundle({ rules: [], digest: "not-used" });
  assert.throws(() => registry.register(invalid), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_INVALID");
});

test("F4-005 activation is explicit and recorded", () => {
  const registry = new PolicyRegistry();
  const item = makeBundle();
  registry.register(item);
  assert.equal(registry.get("access", "1").lifecycle, "registered");
  const active = registry.activate("access", "1", t1);
  assert.equal(active.lifecycle, "active");
  assert.equal(registry.lifecycleLog().map((entry) => entry.action).join(","), "REGISTER,ACTIVATE");
});

test("F4-006 retired policy is excluded from current resolution", () => {
  const registry = new PolicyRegistry();
  activate(registry);
  registry.retire("access", "1", t2);
  assert.throws(() => registry.resolve("access", t2), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_RETIRED");
});

test("F4-007 overlapping active versions fail closed", () => {
  const registry = new PolicyRegistry();
  registry.register(makeBundle({ version: "1", effectiveFrom: t0 }));
  registry.register(makeBundle({ version: "2", effectiveFrom: t0 }));
  registry.activate("access", "1", t1);
  assert.throws(() => registry.activate("access", "2", t1), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_AMBIGUOUS");
});

test("F4-008 timestamp-aware resolution selects the version active at the request time", () => {
  const registry = new PolicyRegistry();
  const old = makeBundle({ version: "1", effectiveFrom: t0, expiresAt: t1 });
  const next = makeBundle({ version: "2", effectiveFrom: t1, expiresAt: t2, rules: [{ id: "allow-new", effect: "ALLOW", reason: "New policy" }] });
  registry.register(old);
  registry.register(next);
  registry.activate("access", "1", t0);
  registry.retire("access", "1", t1);
  registry.activate("access", "2", t1);
  assert.equal(registry.resolve("access", "1", "1").version, "1");
  assert.equal(registry.resolve("access", t1).version, "2");
});

test("F4-009 expired policy cannot be activated or evaluated", () => {
  const registry = new PolicyRegistry();
  registry.register(makeBundle({ expiresAt: t1 }));
  assert.throws(() => registry.activate("access", "1", t1), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_EXPIRED");
});

test("F4-010 invalid request identity fails closed", () => {
  assert.throws(() => normalizePolicyRequest(req({ subjectId: "" })), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_INVALID");
  assert.throws(() => normalizePolicyRequest(req({ capabilityId: "" })), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_INVALID");
  assert.throws(() => normalizePolicyRequest(req({ scope: "" })), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_INVALID");
});

test("F4-011 explicit local allow produces attributable ALLOW", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const result = await governance.evaluate(req(), item.policyId);
  assert.equal(result.effect, "ALLOW");
  assert.equal(result.evidence.policyDigest, item.digest);
  assert.equal(result.evidence.ruleId, "allow-evidence");
});

test("F4-012 explicit deny produces attributable DENY", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const result = await governance.evaluate(req({ scope: "evidence/secret/case-1" }), item.policyId);
  assert.equal(result.effect, "DENY");
  assert.equal(result.evidence.ruleId, "deny-secret");
});

test("F4-013 no matching rule is default DENY", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry, makeBundle({ rules: [{ id: "other", effect: "ALLOW", capabilityId: "other", reason: "Other" }] }));
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const result = await governance.evaluate(req(), item.policyId);
  assert.equal(result.effect, "DENY");
  assert.equal(result.evidence.ruleId, "default-deny");
});

test("F4-014 deny overrides allow", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry, makeBundle({ rules: [
    { id: "allow", effect: "ALLOW", capabilityId: "evidence.read", scopePrefix: "evidence", reason: "Allow" },
    { id: "deny", effect: "DENY", capabilityId: "evidence.read", scopePrefix: "evidence", reason: "Deny" },
  ] }));
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  assert.equal((await governance.evaluate(req(), item.policyId)).effect, "DENY");
});

test("F4-015 provider ALLOW is normalized only after local admission", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const adapter: PolicyDecisionAdapter = { evaluate: async () => ({ outcome: "ALLOW", provider: "opa-shaped", providerVersion: "v1", decisionId: "provider-1", ruleId: "provider-allow", reason: "provider allow", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }) };
  const result = await new PolicyGovernance(registry, adapter, limits()).evaluate(req(), item.policyId);
  assert.equal(result.effect, "ALLOW");
  assert.equal(result.evidence.provider, "opa-shaped");
  assert.equal(result.evidence.providerDecisionId, "provider-1");
});

test("F4-016 provider DENY is normalized and retained as evidence", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const adapter: PolicyDecisionAdapter = { evaluate: async () => ({ outcome: "DENY", provider: "cedar-shaped", providerVersion: "v1", decisionId: "provider-deny", ruleId: "provider-rule", reason: "provider deny", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }) };
  const result = await new PolicyGovernance(registry, adapter, limits()).evaluate(req(), item.policyId);
  assert.equal(result.effect, "DENY");
  assert.equal(result.evidence.providerDecisionId, "provider-deny");
});

test("F4-017 provider unavailable becomes INDETERMINATE, never ALLOW", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const adapter: PolicyDecisionAdapter = { evaluate: async () => ({ outcome: "PROVIDER_UNAVAILABLE", provider: "opa-shaped", providerVersion: "v1", reason: "down", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }) };
  const result = await new PolicyGovernance(registry, adapter, limits()).evaluate(req(), item.policyId);
  assert.equal(result.effect, "INDETERMINATE");
  assert.equal(result.evidence.failureCode, "POLICY_PROVIDER_UNAVAILABLE");
});

test("F4-018 malformed provider result fails closed", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const adapter: PolicyDecisionAdapter = { evaluate: async () => ({ outcome: "ALLOW", provider: "", providerVersion: "v1", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }) };
  await assert.rejects(() => new PolicyGovernance(registry, adapter, limits()).evaluate(req(), item.policyId), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_INVALID");
});

test("F4-019 provider incompatibility becomes typed indeterminate", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const adapter: PolicyDecisionAdapter = { evaluate: async () => ({ outcome: "PROVIDER_INCOMPATIBLE", provider: "provider", providerVersion: "v0", reason: "unsupported", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }) };
  const result = await new PolicyGovernance(registry, adapter, limits()).evaluate(req(), item.policyId);
  assert.equal(result.effect, "INDETERMINATE");
  assert.equal(result.evidence.failureCode, "POLICY_PROVIDER_INCOMPATIBLE");
});

test("F4-020 evidence records exact policy identity and request digest", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const ledger = new InMemoryPolicyDecisionLedger();
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits(), ledger);
  const normalized = normalizePolicyRequest(req());
  const result = await governance.evaluate(req(), item.policyId);
  const stored = ledger.all()[0]!;
  assert.equal(result.evidence.policyId, item.policyId);
  assert.equal(result.evidence.policyVersion, item.version);
  assert.equal(result.evidence.policyDigest, item.digest);
  assert.equal(result.evidence.requestDigest, normalized.requestDigest);
  assert.deepEqual(stored, result);
});

test("F4-021 changing request context changes digest without mutating prior evidence", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const first = await governance.evaluate(req({ context: { region: "eg" } }), item.policyId);
  const second = await governance.evaluate(req({ context: { region: "us" } }), item.policyId);
  assert.notEqual(first.evidence.requestDigest, second.evidence.requestDigest);
  assert.notEqual(first.evidence.decisionId, second.evidence.decisionId);
});

test("F4-022 federated requested capability still requires local allow", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry, makeBundle({ rules: [{ id: "other", effect: "ALLOW", capabilityId: "other", reason: "Other" }] }));
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const result = await governance.evaluateFederated(req(), item.policyId, { originDomain: "remote", requestedCapability: "evidence.read", negotiatedCapability: "evidence.read" });
  assert.equal(result.effect, "DENY");
  assert.equal(result.evidence.ruleId, "default-deny");
});

test("F4-023 remote trusted provenance assertion cannot create local allow", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry, makeBundle({ rules: [{ id: "different", effect: "ALLOW", capabilityId: "different", reason: "Different" }] }));
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const result = await governance.evaluateFederated(req(), item.policyId, { originDomain: "trusted", remotePolicyAssertion: "allow:evidence.read" });
  assert.equal(result.effect, "DENY");
});

test("F4-024 oversized policy is rejected before provider evaluation", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry, makeBundle({ rules: [{ id: "allow", effect: "ALLOW", reason: "x".repeat(5_000) }] }));
  let calls = 0;
  const adapter: PolicyDecisionAdapter = { evaluate: async () => { calls += 1; return { outcome: "ALLOW", provider: "fake", providerVersion: "1", decisionId: "1", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }; } };
  await assert.rejects(() => new PolicyGovernance(registry, adapter, limits({ maxPolicyBytes: 100 })).evaluate(req(), item.policyId), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_RESOURCE_EXHAUSTED");
  assert.equal(calls, 0);
});

test("F4-025 excessive rule count is rejected before evaluation", async () => {
  const registry = new PolicyRegistry();
  const rules = Array.from({ length: 4 }, (_, index) => ({ id: `r-${index}`, effect: "ALLOW" as const, reason: "r" }));
  const item = activate(registry, makeBundle({ rules }));
  let calls = 0;
  const adapter: PolicyDecisionAdapter = { evaluate: async () => { calls += 1; return { outcome: "ALLOW", provider: "fake", providerVersion: "1", decisionId: "1", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }; } };
  await assert.rejects(() => new PolicyGovernance(registry, adapter, limits({ maxRules: 2 })).evaluate(req(), item.policyId), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_RESOURCE_EXHAUSTED");
  assert.equal(calls, 0);
});

test("F4-026 excessive context is rejected before evaluation", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  let calls = 0;
  const adapter: PolicyDecisionAdapter = { evaluate: async () => { calls += 1; return { outcome: "ALLOW", provider: "fake", providerVersion: "1", decisionId: "1", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }; } };
  await assert.rejects(() => new PolicyGovernance(registry, adapter, limits({ maxContextEntries: 1 })).evaluate(req({ context: { a: 1, b: 2 } }), item.policyId), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_RESOURCE_EXHAUSTED");
  assert.equal(calls, 0);
});

test("F4-027 concurrent evaluation limit blocks bypass", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const adapter: PolicyDecisionAdapter = { evaluate: async () => { calls += 1; await held; return { outcome: "ALLOW", provider: "fake", providerVersion: "1", decisionId: `d-${calls}`, policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }; } };
  const governance = new PolicyGovernance(registry, adapter, limits({ maxConcurrentEvaluations: 1 }));
  const first = governance.evaluate(req(), item.policyId);
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(() => governance.evaluate(req({ subjectId: "subject-2" }), item.policyId), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_RESOURCE_EXHAUSTED");
  release();
  await first;
  assert.equal(calls, 1);
});

test("F4-028 same request and exact policy replay to deterministic evidence", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const first = await governance.evaluate(req(), item.policyId);
  const second = await governance.evaluate(req(), item.policyId);
  assert.deepEqual(first, second);
});

test("F4-029 policy digest tampering fails before evaluation", async () => {
  const registry = new PolicyRegistry();
  const item = makeBundle();
  registry.register(item);
  const tampered = { ...item, digest: "0".repeat(64) };
  const secondRegistry = new PolicyRegistry();
  assert.throws(() => secondRegistry.register(tampered), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_INTEGRITY_FAILURE");
});

test("F4-030 provenance tampering changes digest and is not trusted automatically", async () => {
  const registry = new PolicyRegistry();
  const item = makeBundle();
  registry.register(item);
  const tampered = makeBundle({ provenanceId: "attacker" });
  assert.throws(() => registry.register({ ...tampered, policyId: item.policyId, version: item.version }), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_INTEGRITY_FAILURE");
});

test("F4-031 provider metadata cannot widen local scope", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry, makeBundle({ rules: [{ id: "allow-narrow", effect: "ALLOW", capabilityId: "evidence.read", scopePrefix: "evidence/narrow", reason: "Narrow" }] }));
  let calls = 0;
  const adapter: PolicyDecisionAdapter = { evaluate: async () => { calls += 1; return { outcome: "ALLOW", provider: "remote", providerVersion: "1", decisionId: "remote", ruleId: "remote-broad", reason: "Broad allow", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }; } };
  const result = await new PolicyGovernance(registry, adapter, limits()).evaluate(req({ scope: "evidence/broad" }), item.policyId);
  assert.equal(result.effect, "DENY");
  assert.equal(calls, 0);
});

test("F4-032 missing policy returns typed not-found", async () => {
  const governance = new PolicyGovernance(new PolicyRegistry(), new LocalDeterministicPolicyAdapter(), limits());
  await assert.rejects(() => governance.evaluate(req(), "missing"), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_NOT_FOUND");
});

test("F4-033 ambiguous policy resolution is typed", async () => {
  const registry = new PolicyRegistry();
  registry.register(makeBundle({ version: "1" }));
  registry.register(makeBundle({ version: "2" }));
  registry.activate("access", "1", t0);
  registry.records;
  assert.throws(() => registry.activate("access", "2", t1), (error: unknown) => error instanceof PolicyGovernanceError && error.code === "POLICY_AMBIGUOUS");
});

test("F4-034 provider incompatibility is explicitly attributable", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const adapter: PolicyDecisionAdapter = { evaluate: async () => ({ outcome: "PROVIDER_INCOMPATIBLE", provider: "provider-x", providerVersion: "0", reason: "unsupported semantics", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }) };
  const result = await new PolicyGovernance(registry, adapter, limits()).evaluate(req(), item.policyId);
  assert.equal(result.evidence.failureCode, "POLICY_PROVIDER_INCOMPATIBLE");
});

test("F4-035 explicit invalid provider outcome never becomes allow", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const adapter: PolicyDecisionAdapter = { evaluate: async () => ({ outcome: "INVALID_RESULT", provider: "provider", providerVersion: "1", reason: "bad", policyId: item.policyId, policyVersion: item.version, policyDigest: item.digest }) };
  const result = await new PolicyGovernance(registry, adapter, limits()).evaluate(req(), item.policyId);
  assert.equal(result.effect, "INDETERMINATE");
  assert.equal(result.evidence.failureCode, "POLICY_INVALID_RESULT");
});

test("F4-036 concurrent duplicate registration cannot replace content", () => {
  const registry = new PolicyRegistry();
  const item = makeBundle();
  const divergent = makeBundle({ rules: [{ id: "different", effect: "ALLOW", reason: "Different" }] });
  Promise.allSettled([
    Promise.resolve().then(() => registry.register(item)),
    Promise.resolve().then(() => registry.register(divergent)),
  ]);
  assert.equal(registry.get("access", "1").digest, item.digest);
});

test("F4-037 concurrent activation is deterministic under synchronous registry mutation", () => {
  const registry = new PolicyRegistry();
  const item = makeBundle();
  registry.register(item);
  const outcomes = [
    () => registry.activate("access", "1", t1),
    () => registry.activate("access", "1", t1),
  ].map((run) => { try { return { ok: true, value: run().version }; } catch (error) { return { ok: false, error }; } });
  assert.equal(outcomes.filter((x) => x.ok).length, 2);
  assert.equal(registry.get("access", "1").lifecycle, "active");
});

test("F4-038 evaluation remains bound to resolved version even after retirement", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const first = await governance.evaluate(req({ at: t1 }), item.policyId);
  registry.retire(item.policyId, item.version, t2);
  const replay = await governance.evaluate(req({ at: t1 }), item.policyId, item.version);
  assert.equal(first.evidence.policyVersion, "1");
  assert.equal(replay.evidence.policyVersion, "1");
  assert.deepEqual(first, replay);
});

test("F4-039 decision ledger is caller-immutable", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const ledger = new InMemoryPolicyDecisionLedger();
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits(), ledger);
  const result = await governance.evaluate(req(), item.policyId);
  const copy = ledger.all()[0]!;
  copy.evidence.reason = "caller mutation";
  const stored = ledger.all()[0]!;
  assert.equal(stored.evidence.reason, result.evidence.reason);
});

test("F4-040 federated request still follows local policy boundary", async () => {
  const registry = new PolicyRegistry();
  const item = activate(registry);
  const governance = new PolicyGovernance(registry, new LocalDeterministicPolicyAdapter(), limits());
  const denied = await governance.evaluateFederated(req({ scope: "evidence/secret/case-2" }), item.policyId, { originDomain: "remote", peerId: "peer-1", requestedCapability: "evidence.read", negotiatedCapability: "evidence.read", remotePolicyAssertion: "ALLOW" });
  assert.equal(denied.effect, "DENY");
  const allowed = await governance.evaluateFederated(req(), item.policyId, { originDomain: "remote", peerId: "peer-1", requestedCapability: "evidence.read", negotiatedCapability: "evidence.read", remotePolicyAssertion: "ALLOW" });
  assert.equal(allowed.effect, "ALLOW");
  assert.equal(allowed.evidence.policyVersion, item.version);
});
