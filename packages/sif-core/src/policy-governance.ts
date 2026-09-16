import { cryptoRandomId, digest, now, stableStringify } from "./core.js";

export type PolicyLifecycle = "registered" | "active" | "retired";
export type GovernanceEffect = "ALLOW" | "DENY" | "INDETERMINATE";
export type PolicyProviderOutcome = "ALLOW" | "DENY" | "INDETERMINATE" | "INVALID_RESULT" | "PROVIDER_UNAVAILABLE" | "PROVIDER_INCOMPATIBLE";

export type PolicyPrimitive = string | number | boolean | null;

export interface PolicyRule {
  id: string;
  effect: Exclude<GovernanceEffect, "INDETERMINATE">;
  subjectId?: string;
  capabilityId?: string;
  scopePrefix?: string;
  contextEquals?: Record<string, PolicyPrimitive>;
  reason: string;
}

export interface PolicyBundle {
  policyId: string;
  version: string;
  source: string;
  provenanceId: string;
  effectiveFrom: string;
  expiresAt?: string;
  rules: PolicyRule[];
  digest: string;
  lifecycle: PolicyLifecycle;
}

export interface PolicyRequest {
  subjectId: string;
  capabilityId: string;
  scope: string;
  at: string;
  context?: Record<string, unknown>;
}

export interface NormalizedPolicyRequest extends PolicyRequest {
  requestDigest: string;
}

export interface ExternalPolicyResult {
  outcome: PolicyProviderOutcome;
  provider: string;
  providerVersion: string;
  decisionId?: string;
  ruleId?: string;
  reason?: string;
  policyId: string;
  policyVersion: string;
  policyDigest: string;
}

export interface PolicyDecisionEvidence {
  decisionId: string;
  effect: GovernanceEffect;
  policyId: string;
  policyVersion: string;
  policyDigest: string;
  requestDigest: string;
  ruleId: string;
  reason: string;
  decidedAt: string;
  validUntil?: string;
  provider: string;
  providerVersion: string;
  providerDecisionId?: string;
}

export interface PolicyDecision {
  effect: GovernanceEffect;
  evidence: PolicyDecisionEvidence;
}

export interface PolicyDecisionAdapter {
  evaluate(request: NormalizedPolicyRequest, bundle: PolicyBundle): Promise<ExternalPolicyResult>;
}

export interface PolicyGovernanceLimits {
  maxPolicyBytes: number;
  maxRules: number;
  maxContextEntries: number;
  maxConcurrentEvaluations: number;
}

export type PolicyGovernanceErrorCode =
  | "POLICY_NOT_FOUND"
  | "POLICY_AMBIGUOUS"
  | "POLICY_EXPIRED"
  | "POLICY_RETIRED"
  | "POLICY_INVALID"
  | "POLICY_INTEGRITY_FAILURE"
  | "POLICY_PROVIDER_UNAVAILABLE"
  | "POLICY_PROVIDER_INCOMPATIBLE"
  | "POLICY_INVALID_RESULT"
  | "POLICY_RESOURCE_EXHAUSTED"
  | "POLICY_DENIED";

export class PolicyGovernanceError extends Error {
  constructor(readonly code: PolicyGovernanceErrorCode, message: string) {
    super(message);
    this.name = "PolicyGovernanceError";
  }
}

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new PolicyGovernanceError("POLICY_INVALID", `${name} must not be empty`);
}

function assertIso(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new PolicyGovernanceError("POLICY_INVALID", `${name} must be a valid ISO date`);
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", `${name} must be a positive safe integer`);
}

function cloneBundle(bundle: PolicyBundle): PolicyBundle {
  return {
    ...bundle,
    rules: bundle.rules.map((rule) => ({
      ...rule,
      ...(rule.contextEquals === undefined ? {} : { contextEquals: { ...rule.contextEquals } }),
    })),
  };
}

function canonicalPolicyContent(bundle: Omit<PolicyBundle, "digest" | "lifecycle">): string {
  return stableStringify(bundle);
}

export function computePolicyDigest(bundle: Omit<PolicyBundle, "digest" | "lifecycle">): string {
  return digest(canonicalPolicyContent(bundle));
}

function validateRule(rule: PolicyRule, index: number): void {
  assertNonEmpty(`rules[${index}].id`, rule.id);
  assertNonEmpty(`rules[${index}].reason`, rule.reason);
  if (rule.subjectId !== undefined) assertNonEmpty(`rules[${index}].subjectId`, rule.subjectId);
  if (rule.capabilityId !== undefined) assertNonEmpty(`rules[${index}].capabilityId`, rule.capabilityId);
  if (rule.scopePrefix !== undefined) assertNonEmpty(`rules[${index}].scopePrefix`, rule.scopePrefix);
  if (rule.contextEquals !== undefined) {
    for (const [key, value] of Object.entries(rule.contextEquals)) {
      assertNonEmpty(`rules[${index}].contextEquals key`, key);
      if (typeof value === "object" && value !== null) {
        throw new PolicyGovernanceError("POLICY_INVALID", `rules[${index}].contextEquals values must be JSON primitives`);
      }
    }
  }
}

function validateBundle(bundle: PolicyBundle): void {
  assertNonEmpty("policyId", bundle.policyId);
  assertNonEmpty("version", bundle.version);
  assertNonEmpty("source", bundle.source);
  assertNonEmpty("provenanceId", bundle.provenanceId);
  assertNonEmpty("digest", bundle.digest);
  assertIso("effectiveFrom", bundle.effectiveFrom);
  if (bundle.expiresAt !== undefined) {
    assertIso("expiresAt", bundle.expiresAt);
    if (Date.parse(bundle.expiresAt) <= Date.parse(bundle.effectiveFrom)) {
      throw new PolicyGovernanceError("POLICY_INVALID", "expiresAt must be after effectiveFrom");
    }
  }
  if (bundle.rules.length === 0) throw new PolicyGovernanceError("POLICY_INVALID", "Policy bundle must contain at least one rule");
  const ids = new Set<string>();
  for (let index = 0; index < bundle.rules.length; index += 1) {
    const rule = bundle.rules[index]!;
    validateRule(rule, index);
    if (ids.has(rule.id)) throw new PolicyGovernanceError("POLICY_INVALID", `Duplicate policy rule: ${rule.id}`);
    ids.add(rule.id);
  }
  const content: Omit<PolicyBundle, "digest" | "lifecycle"> = {
    policyId: bundle.policyId,
    version: bundle.version,
    source: bundle.source,
    provenanceId: bundle.provenanceId,
    effectiveFrom: bundle.effectiveFrom,
    ...(bundle.expiresAt === undefined ? {} : { expiresAt: bundle.expiresAt }),
    rules: bundle.rules,
  };
  if (computePolicyDigest(content) !== bundle.digest) {
    throw new PolicyGovernanceError("POLICY_INTEGRITY_FAILURE", `Policy digest mismatch for ${bundle.policyId}@${bundle.version}`);
  }
}

function activeAt(bundle: PolicyBundle, at: string): boolean {
  const timestamp = Date.parse(at);
  return bundle.lifecycle === "active" && timestamp >= Date.parse(bundle.effectiveFrom) && (bundle.expiresAt === undefined || timestamp < Date.parse(bundle.expiresAt));
}

export class PolicyRegistry {
  private readonly bundles = new Map<string, PolicyBundle>();
  private readonly lifecycleEvidence: Array<{ policyId: string; version: string; action: "REGISTER" | "ACTIVATE" | "RETIRE"; at: string; provenanceId: string }> = [];

  register(bundle: PolicyBundle): void {
    validateBundle(bundle);
    if (bundle.lifecycle !== "registered") {
      throw new PolicyGovernanceError("POLICY_INVALID", "New policy versions must start in registered lifecycle state");
    }
    const key = this.key(bundle.policyId, bundle.version);
    const existing = this.bundles.get(key);
    if (existing) {
      if (existing.digest !== bundle.digest) {
        throw new PolicyGovernanceError("POLICY_INTEGRITY_FAILURE", `Policy version is immutable: ${key}`);
      }
      return;
    }
    this.bundles.set(key, cloneBundle(bundle));
    this.lifecycleEvidence.push({ policyId: bundle.policyId, version: bundle.version, action: "REGISTER", at: bundle.effectiveFrom, provenanceId: bundle.provenanceId });
  }

  activate(policyId: string, version: string, at: string): PolicyBundle {
    assertNonEmpty("policyId", policyId);
    assertNonEmpty("version", version);
    assertIso("at", at);
    const bundle = this.get(policyId, version);
    if (bundle.lifecycle === "retired") throw new PolicyGovernanceError("POLICY_RETIRED", `Policy is retired: ${policyId}@${version}`);
    const timestamp = Date.parse(at);
    if (timestamp < Date.parse(bundle.effectiveFrom) || (bundle.expiresAt !== undefined && timestamp >= Date.parse(bundle.expiresAt))) {
      throw new PolicyGovernanceError("POLICY_EXPIRED", `Policy is outside its effective window: ${policyId}@${version}`);
    }
    const overlap = this.list(policyId).find((candidate) => candidate.version !== version && activeAt(candidate, at));
    if (overlap) throw new PolicyGovernanceError("POLICY_AMBIGUOUS", `Another active policy version overlaps at ${at}: ${overlap.version}`);
    const updated = { ...bundle, lifecycle: "active" as const };
    this.bundles.set(this.key(policyId, version), updated);
    this.lifecycleEvidence.push({ policyId, version, action: "ACTIVATE", at, provenanceId: bundle.provenanceId });
    return cloneBundle(updated);
  }

  retire(policyId: string, version: string, at: string): PolicyBundle {
    assertIso("at", at);
    const bundle = this.get(policyId, version);
    const updated = { ...bundle, lifecycle: "retired" as const };
    this.bundles.set(this.key(policyId, version), updated);
    this.lifecycleEvidence.push({ policyId, version, action: "RETIRE", at, provenanceId: bundle.provenanceId });
    return cloneBundle(updated);
  }

  resolve(policyId: string, at: string): PolicyBundle {
    assertIso("at", at);
    const candidates = this.list(policyId).filter((bundle) => activeAt(bundle, at));
    if (candidates.length === 0) {
      const known = this.list(policyId);
      if (known.length === 0) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `No policy exists for ${policyId}`);
      if (known.every((bundle) => bundle.lifecycle === "retired")) throw new PolicyGovernanceError("POLICY_RETIRED", `All policy versions are retired for ${policyId}`);
      if (known.every((bundle) => bundle.expiresAt !== undefined && Date.parse(bundle.expiresAt) <= Date.parse(at))) throw new PolicyGovernanceError("POLICY_EXPIRED", `No policy version is active at ${at}: ${policyId}`);
      throw new PolicyGovernanceError("POLICY_NOT_FOUND", `No active policy version at ${at}: ${policyId}`);
    }
    if (candidates.length > 1) throw new PolicyGovernanceError("POLICY_AMBIGUOUS", `Multiple policy versions are active at ${at}: ${policyId}`);
    return cloneBundle(candidates[0]!);
  }

  get(policyId: string, version: string): PolicyBundle {
    const bundle = this.bundles.get(this.key(policyId, version));
    if (!bundle) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
    return cloneBundle(bundle);
  }

  list(policyId?: string): PolicyBundle[] {
    return [...this.bundles.values()]
      .filter((bundle) => policyId === undefined || bundle.policyId === policyId)
      .sort((a, b) => `${a.policyId}\u0000${a.version}` < `${b.policyId}\u0000${b.version}` ? -1 : 1)
      .map(cloneBundle);
  }

  lifecycleLog(): Array<{ policyId: string; version: string; action: "REGISTER" | "ACTIVATE" | "RETIRE"; at: string; provenanceId: string }> {
    return this.lifecycleEvidence.map((entry) => ({ ...entry }));
  }

  private key(policyId: string, version: string): string {
    return `${policyId}\u0000${version}`;
  }
}

function matchesRule(rule: PolicyRule, request: NormalizedPolicyRequest): boolean {
  if (rule.subjectId !== undefined && rule.subjectId !== request.subjectId) return false;
  if (rule.capabilityId !== undefined && rule.capabilityId !== request.capabilityId) return false;
  if (rule.scopePrefix !== undefined && request.scope !== rule.scopePrefix && !request.scope.startsWith(`${rule.scopePrefix}/`)) return false;
  if (rule.contextEquals !== undefined) {
    for (const [key, expected] of Object.entries(rule.contextEquals)) {
      if (request.context?.[key] !== expected) return false;
    }
  }
  return true;
}

export class LocalDeterministicPolicyAdapter implements PolicyDecisionAdapter {
  constructor(readonly providerVersion = "builtin-v1") {}

  async evaluate(request: NormalizedPolicyRequest, bundle: PolicyBundle): Promise<ExternalPolicyResult> {
    const matching = bundle.rules.filter((rule) => matchesRule(rule, request));
    const selected = matching.find((rule) => rule.effect === "DENY") ?? matching.find((rule) => rule.effect === "ALLOW");
    if (!selected) {
      return {
        outcome: "DENY",
        provider: "sif-local-policy",
        providerVersion: this.providerVersion,
        ruleId: "default-deny",
        reason: "No matching allow rule",
        policyId: bundle.policyId,
        policyVersion: bundle.version,
        policyDigest: bundle.digest,
      };
    }
    return {
      outcome: selected.effect,
      provider: "sif-local-policy",
      providerVersion: this.providerVersion,
      decisionId: cryptoRandomId(),
      ruleId: selected.id,
      reason: selected.reason,
      policyId: bundle.policyId,
      policyVersion: bundle.version,
      policyDigest: bundle.digest,
    };
  }
}

export function normalizePolicyRequest(request: PolicyRequest): NormalizedPolicyRequest {
  assertNonEmpty("subjectId", request.subjectId);
  assertNonEmpty("capabilityId", request.capabilityId);
  assertNonEmpty("scope", request.scope);
  assertIso("at", request.at);
  const context = request.context === undefined ? undefined : JSON.parse(JSON.stringify(request.context)) as Record<string, unknown>;
  const normalized: PolicyRequest = { subjectId: request.subjectId, capabilityId: request.capabilityId, scope: request.scope, at: request.at, ...(context === undefined ? {} : { context }) };
  return { ...normalized, requestDigest: digest(normalized) };
}

function validateExternalResult(result: ExternalPolicyResult, bundle: PolicyBundle): void {
  if (!["ALLOW", "DENY", "INDETERMINATE", "INVALID_RESULT", "PROVIDER_UNAVAILABLE", "PROVIDER_INCOMPATIBLE"].includes(result.outcome)) {
    throw new PolicyGovernanceError("POLICY_INVALID_RESULT", "Unknown policy provider outcome");
  }
  assertNonEmpty("provider", result.provider);
  assertNonEmpty("providerVersion", result.providerVersion);
  if (result.policyId !== bundle.policyId || result.policyVersion !== bundle.version || result.policyDigest !== bundle.digest) {
    throw new PolicyGovernanceError("POLICY_INVALID_RESULT", "Provider result is not bound to the resolved policy bundle");
  }
  if (result.ruleId !== undefined) assertNonEmpty("ruleId", result.ruleId);
  if (result.reason !== undefined) assertNonEmpty("reason", result.reason);
  if (result.decisionId !== undefined) assertNonEmpty("decisionId", result.decisionId);
}

export class PolicyGovernance {
  private activeEvaluations = 0;

  constructor(
    private readonly registry: PolicyRegistry,
    private readonly adapter: PolicyDecisionAdapter,
    private readonly limits: PolicyGovernanceLimits,
  ) {
    assertPositiveInteger("maxPolicyBytes", limits.maxPolicyBytes);
    assertPositiveInteger("maxRules", limits.maxRules);
    assertPositiveInteger("maxContextEntries", limits.maxContextEntries);
    assertPositiveInteger("maxConcurrentEvaluations", limits.maxConcurrentEvaluations);
  }

  async evaluate(request: PolicyRequest, policyId: string): Promise<PolicyDecision> {
    if (this.activeEvaluations >= this.limits.maxConcurrentEvaluations) {
      throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", "Concurrent policy evaluation limit exceeded");
    }
    const normalized = normalizePolicyRequest(request);
    if (normalized.context !== undefined && Object.keys(normalized.context).length > this.limits.maxContextEntries) {
      throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", "Policy context entry limit exceeded");
    }

    const bundle = this.registry.resolve(policyId, request.at);
    if (bundle.rules.length > this.limits.maxRules) throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", "Policy rule limit exceeded");
    if (Buffer.byteLength(canonicalPolicyContent({
      policyId: bundle.policyId,
      version: bundle.version,
      source: bundle.source,
      provenanceId: bundle.provenanceId,
      effectiveFrom: bundle.effectiveFrom,
      ...(bundle.expiresAt === undefined ? {} : { expiresAt: bundle.expiresAt }),
      rules: bundle.rules,
    }), "utf8") > this.limits.maxPolicyBytes) {
      throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", "Policy bundle size limit exceeded");
    }

    this.activeEvaluations += 1;
    try {
      let result: ExternalPolicyResult;
      try {
        result = await this.adapter.evaluate(normalized, bundle);
      } catch (error) {
        throw new PolicyGovernanceError("POLICY_PROVIDER_UNAVAILABLE", error instanceof Error ? error.message : "Policy provider evaluation failed");
      }
      validateExternalResult(result, bundle);
      const decidedAt = now();
      if (result.outcome === "PROVIDER_UNAVAILABLE") throw new PolicyGovernanceError("POLICY_PROVIDER_UNAVAILABLE", result.reason ?? "Policy provider unavailable");
      if (result.outcome === "PROVIDER_INCOMPATIBLE") throw new PolicyGovernanceError("POLICY_PROVIDER_INCOMPATIBLE", result.reason ?? "Policy provider incompatible");
      if (result.outcome === "INVALID_RESULT") throw new PolicyGovernanceError("POLICY_INVALID_RESULT", result.reason ?? "Policy provider returned an invalid result");

      const effect: GovernanceEffect = result.outcome;
      const ruleId = result.ruleId ?? (effect === "DENY" ? "provider-deny" : effect === "ALLOW" ? "provider-allow" : "provider-indeterminate");
      const reason = result.reason ?? (effect === "DENY" ? "Policy denied the request" : effect === "ALLOW" ? "Policy allowed the request" : "Policy outcome is indeterminate");
      const evidence: PolicyDecisionEvidence = {
        decisionId: result.decisionId ?? cryptoRandomId(),
        effect,
        policyId: bundle.policyId,
        policyVersion: bundle.version,
        policyDigest: bundle.digest,
        requestDigest: normalized.requestDigest,
        ruleId,
        reason,
        decidedAt,
        ...(bundle.expiresAt === undefined ? {} : { validUntil: bundle.expiresAt }),
        provider: result.provider,
        providerVersion: result.providerVersion,
        ...(result.decisionId === undefined ? {} : { providerDecisionId: result.decisionId }),
      };
      return { effect, evidence };
    } finally {
      this.activeEvaluations -= 1;
    }
  }
}
