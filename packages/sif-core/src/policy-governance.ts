import { digest, stableStringify } from "./core.js";

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

export interface PolicyBundleContent {
  policyId: string;
  version: string;
  source: string;
  provenanceId: string;
  effectiveFrom: string;
  expiresAt?: string;
  rules: PolicyRule[];
}

export interface PolicyBundle extends PolicyBundleContent {
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
  contextBytes: number;
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
  failureCode?: PolicyGovernanceErrorCode;
}

export interface PolicyDecision {
  effect: GovernanceEffect;
  evidence: PolicyDecisionEvidence;
}

export interface PolicyDecisionAdapter {
  evaluate(request: NormalizedPolicyRequest, bundle: PolicyBundle): Promise<ExternalPolicyResult>;
}

export interface PolicyDecisionLedger {
  append(decision: PolicyDecision): void;
  all(): PolicyDecision[];
}

export class InMemoryPolicyDecisionLedger implements PolicyDecisionLedger {
  private readonly entries: PolicyDecision[] = [];
  append(decision: PolicyDecision): void { this.entries.push(structuredClone(decision)); }
  all(): PolicyDecision[] { return this.entries.map((entry) => structuredClone(entry)); }
}

export interface PolicyGovernanceLimits {
  maxPolicyBytes: number;
  maxRules: number;
  maxContextEntries: number;
  maxContextBytes: number;
  maxVersionsPerPolicy: number;
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

function nonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new PolicyGovernanceError("POLICY_INVALID", `${name} must not be empty`);
}
function iso(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new PolicyGovernanceError("POLICY_INVALID", `${name} must be a valid ISO date`);
}
function positive(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", `${name} must be a positive safe integer`);
}
function bytes(value: string): number { return new TextEncoder().encode(value).byteLength; }

function validateJson(value: unknown, path: string): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new PolicyGovernanceError("POLICY_INVALID", `${path} must contain finite numbers`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJson(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      nonEmpty(`${path} key`, key);
      validateJson(nested, `${path}.${key}`);
    }
    return;
  }
  throw new PolicyGovernanceError("POLICY_INVALID", `${path} contains an unsupported value type`);
}

function canonical(bundle: PolicyBundle): PolicyBundleContent {
  return {
    policyId: bundle.policyId,
    version: bundle.version,
    source: bundle.source,
    provenanceId: bundle.provenanceId,
    effectiveFrom: bundle.effectiveFrom,
    ...(bundle.expiresAt === undefined ? {} : { expiresAt: bundle.expiresAt }),
    rules: bundle.rules,
  };
}

export function computePolicyDigest(content: PolicyBundleContent): string { return digest(stableStringify(content)); }

function validateBundle(bundle: PolicyBundle): void {
  nonEmpty("policyId", bundle.policyId); nonEmpty("version", bundle.version); nonEmpty("source", bundle.source); nonEmpty("provenanceId", bundle.provenanceId); nonEmpty("digest", bundle.digest);
  iso("effectiveFrom", bundle.effectiveFrom);
  if (bundle.expiresAt !== undefined) { iso("expiresAt", bundle.expiresAt); if (Date.parse(bundle.expiresAt) <= Date.parse(bundle.effectiveFrom)) throw new PolicyGovernanceError("POLICY_INVALID", "expiresAt must be after effectiveFrom"); }
  if (bundle.rules.length === 0) throw new PolicyGovernanceError("POLICY_INVALID", "Policy bundle must contain at least one rule");
  const ids = new Set<string>();
  bundle.rules.forEach((rule, index) => {
    nonEmpty(`rules[${index}].id`, rule.id); nonEmpty(`rules[${index}].reason`, rule.reason);
    if (rule.subjectId !== undefined) nonEmpty(`rules[${index}].subjectId`, rule.subjectId);
    if (rule.capabilityId !== undefined) nonEmpty(`rules[${index}].capabilityId`, rule.capabilityId);
    if (rule.scopePrefix !== undefined) nonEmpty(`rules[${index}].scopePrefix`, rule.scopePrefix);
    if (rule.contextEquals !== undefined) Object.entries(rule.contextEquals).forEach(([key, value]) => { nonEmpty(`rules[${index}].contextEquals key`, key); if (typeof value === "number" && !Number.isFinite(value)) throw new PolicyGovernanceError("POLICY_INVALID", "contextEquals contains a non-finite number"); });
    if (ids.has(rule.id)) throw new PolicyGovernanceError("POLICY_INVALID", `Duplicate policy rule: ${rule.id}`);
    ids.add(rule.id);
  });
  if (computePolicyDigest(canonical(bundle)) !== bundle.digest) throw new PolicyGovernanceError("POLICY_INTEGRITY_FAILURE", `Policy digest mismatch for ${bundle.policyId}@${bundle.version}`);
}

interface PolicyRecord { bundle: PolicyBundle; activatedAt?: string; retiredAt?: string; }
function inActiveInterval(record: PolicyRecord, at: string): boolean {
  const t = Date.parse(at); const start = Date.parse(record.activatedAt ?? record.bundle.effectiveFrom);
  if (!Number.isFinite(t) || !Number.isFinite(start) || t < start) return false;
  if (t < Date.parse(record.bundle.effectiveFrom)) return false;
  if (record.bundle.expiresAt !== undefined && t >= Date.parse(record.bundle.expiresAt)) return false;
  if (record.retiredAt !== undefined && t >= Date.parse(record.retiredAt)) return false;
  return record.activatedAt !== undefined;
}
function cloneBundle(bundle: PolicyBundle): PolicyBundle { return structuredClone(bundle); }
function cloneDecision(decision: PolicyDecision): PolicyDecision { return structuredClone(decision); }

export interface PolicyRegistryOptions { maxVersionsPerPolicy?: number; }

export class PolicyRegistry {
  private readonly records = new Map<string, PolicyRecord>();
  private readonly lifecycle: Array<{ policyId: string; version: string; action: "REGISTER" | "ACTIVATE" | "RETIRE"; at: string; provenanceId: string }> = [];
  private readonly maxVersionsPerPolicy: number;
  constructor(options: PolicyRegistryOptions = {}) { this.maxVersionsPerPolicy = options.maxVersionsPerPolicy ?? 64; positive("maxVersionsPerPolicy", this.maxVersionsPerPolicy); }

  register(bundle: PolicyBundle): void {
    validateBundle(bundle);
    if (bundle.lifecycle !== "registered") throw new PolicyGovernanceError("POLICY_INVALID", "New policy versions must start registered");
    const key = this.key(bundle.policyId, bundle.version); const existing = this.records.get(key);
    if (existing) { if (existing.bundle.digest !== bundle.digest) throw new PolicyGovernanceError("POLICY_INTEGRITY_FAILURE", `Policy version is immutable: ${key}`); return; }
    if (this.list(bundle.policyId).length >= this.maxVersionsPerPolicy) throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", `Policy version retention limit reached for ${bundle.policyId}`);
    this.records.set(key, { bundle: cloneBundle(bundle) });
    this.lifecycle.push({ policyId: bundle.policyId, version: bundle.version, action: "REGISTER", at: bundle.effectiveFrom, provenanceId: bundle.provenanceId });
  }

  activate(policyId: string, version: string, at: string): PolicyBundle {
    nonEmpty("policyId", policyId); nonEmpty("version", version); iso("at", at);
    const record = this.records.get(this.key(policyId, version));
    if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
    if (record.bundle.lifecycle === "retired") throw new PolicyGovernanceError("POLICY_RETIRED", `Policy is retired: ${policyId}@${version}`);
    if (record.activatedAt !== undefined) return cloneBundle(record.bundle);
    const t = Date.parse(at); if (t < Date.parse(record.bundle.effectiveFrom) || (record.bundle.expiresAt !== undefined && t >= Date.parse(record.bundle.expiresAt))) throw new PolicyGovernanceError("POLICY_EXPIRED", `Policy is outside its effective window: ${policyId}@${version}`);
    const overlap = [...this.records.values()].find((candidate) => candidate.bundle.policyId === policyId && candidate.bundle.version !== version && inActiveInterval(candidate, at));
    if (overlap) throw new PolicyGovernanceError("POLICY_AMBIGUOUS", `Another active policy version overlaps at ${at}: ${overlap.bundle.version}`);
    record.activatedAt = at; record.bundle = { ...record.bundle, lifecycle: "active" };
    this.lifecycle.push({ policyId, version, action: "ACTIVATE", at, provenanceId: record.bundle.provenanceId });
    return cloneBundle(record.bundle);
  }

  retire(policyId: string, version: string, at: string): PolicyBundle {
    iso("at", at);
    const record = this.records.get(this.key(policyId, version));
    if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
    if (record.bundle.lifecycle === "retired") return cloneBundle(record.bundle);
    if (record.activatedAt === undefined) throw new PolicyGovernanceError("POLICY_INVALID", "Registered policy cannot be retired before activation");
    if (Date.parse(at) < Date.parse(record.activatedAt)) throw new PolicyGovernanceError("POLICY_INVALID", "Retirement time must not precede activation time");
    record.retiredAt = at; record.bundle = { ...record.bundle, lifecycle: "retired" };
    this.lifecycle.push({ policyId, version, action: "RETIRE", at, provenanceId: record.bundle.provenanceId });
    return cloneBundle(record.bundle);
  }

  resolve(policyId: string, at: string, version?: string): PolicyBundle {
    nonEmpty("policyId", policyId); iso("at", at);
    if (version !== undefined) {
      const record = this.records.get(this.key(policyId, version));
      if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
      if (!inActiveInterval(record, at)) {
        if (record.bundle.lifecycle === "retired") throw new PolicyGovernanceError("POLICY_RETIRED", `Policy version is not active at ${at}: ${policyId}@${version}`);
        throw new PolicyGovernanceError("POLICY_EXPIRED", `Policy version is not active at ${at}: ${policyId}@${version}`);
      }
      return cloneBundle(record.bundle);
    }
    const candidates = [...this.records.values()].filter((record) => record.bundle.policyId === policyId && inActiveInterval(record, at));
    if (candidates.length === 1) return cloneBundle(candidates[0]!.bundle);
    if (candidates.length > 1) throw new PolicyGovernanceError("POLICY_AMBIGUOUS", `Multiple policy versions are active at ${at}: ${policyId}`);
    const known = this.list(policyId);
    if (known.length === 0) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `No policy exists for ${policyId}`);
    if (known.every((bundle) => bundle.lifecycle === "retired")) throw new PolicyGovernanceError("POLICY_RETIRED", `All policy versions are retired for ${policyId}`);
    if (known.every((bundle) => bundle.expiresAt !== undefined && Date.parse(bundle.expiresAt) <= Date.parse(at))) throw new PolicyGovernanceError("POLICY_EXPIRED", `No policy version is active at ${at}: ${policyId}`);
    throw new PolicyGovernanceError("POLICY_NOT_FOUND", `No active policy version at ${at}: ${policyId}`);
  }

  get(policyId: string, version: string): PolicyBundle { const record = this.records.get(this.key(policyId, version)); if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`); return cloneBundle(record.bundle); }
  list(policyId?: string): PolicyBundle[] { return [...this.records.values()].filter((r) => policyId === undefined || r.bundle.policyId === policyId).sort((a,b) => `${a.bundle.policyId}\u0000${a.bundle.version}`.localeCompare(`${b.bundle.policyId}\u0000${b.bundle.version}`)).map((r) => cloneBundle(r.bundle)); }
  lifecycleLog(): Array<{ policyId: string; version: string; action: "REGISTER" | "ACTIVATE" | "RETIRE"; at: string; provenanceId: string }> { return structuredClone(this.lifecycle); }
  private key(policyId: string, version: string): string { return `${policyId}\u0000${version}`; }
}

function matches(rule: PolicyRule, request: NormalizedPolicyRequest): boolean {
  if (rule.subjectId !== undefined && rule.subjectId !== request.subjectId) return false;
  if (rule.capabilityId !== undefined && rule.capabilityId !== request.capabilityId) return false;
  if (rule.scopePrefix !== undefined && request.scope !== rule.scopePrefix && !request.scope.startsWith(`${rule.scopePrefix}/`)) return false;
  if (rule.contextEquals !== undefined) for (const [key, expected] of Object.entries(rule.contextEquals)) if (request.context?.[key] !== expected) return false;
  return true;
}

function localRules(bundle: PolicyBundle, request: NormalizedPolicyRequest): { deny: PolicyRule | undefined; allow: PolicyRule | undefined } {
  const found = bundle.rules.filter((rule) => matches(rule, request));
  return { deny: found.find((rule) => rule.effect === "DENY"), allow: found.find((rule) => rule.effect === "ALLOW") };
}

export class LocalDeterministicPolicyAdapter implements PolicyDecisionAdapter {
  constructor(readonly providerVersion = "builtin-v1") {}
  async evaluate(request: NormalizedPolicyRequest, bundle: PolicyBundle): Promise<ExternalPolicyResult> {
    const { deny, allow } = localRules(bundle, request); const selected = deny ?? allow;
    if (selected === undefined) return { outcome: "DENY", provider: "sif-local-policy", providerVersion: this.providerVersion, decisionId: digest({ policyId: bundle.policyId, version: bundle.version, policyDigest: bundle.digest, requestDigest: request.requestDigest, ruleId: "default-deny" }), ruleId: "default-deny", reason: "No matching allow rule", policyId: bundle.policyId, policyVersion: bundle.version, policyDigest: bundle.digest };
    return { outcome: selected.effect, provider: "sif-local-policy", providerVersion: this.providerVersion, decisionId: digest({ policyId: bundle.policyId, version: bundle.version, policyDigest: bundle.digest, requestDigest: request.requestDigest, ruleId: selected.id, outcome: selected.effect }), ruleId: selected.id, reason: selected.reason, policyId: bundle.policyId, policyVersion: bundle.version, policyDigest: bundle.digest };
  }
}

export function normalizePolicyRequest(request: PolicyRequest): NormalizedPolicyRequest {
  nonEmpty("subjectId", request.subjectId); nonEmpty("capabilityId", request.capabilityId); nonEmpty("scope", request.scope); iso("at", request.at);
  if (request.context !== undefined) validateJson(request.context, "context");
  const context = request.context === undefined ? undefined : structuredClone(request.context);
  const normalized: PolicyRequest = { subjectId: request.subjectId, capabilityId: request.capabilityId, scope: request.scope, at: new Date(request.at).toISOString(), ...(context === undefined ? {} : { context }) };
  return { ...normalized, requestDigest: digest(normalized), contextBytes: context === undefined ? 0 : bytes(stableStringify(context)) };
}

function validateProviderResult(result: ExternalPolicyResult, bundle: PolicyBundle): void {
  nonEmpty("provider", result.provider); nonEmpty("providerVersion", result.providerVersion);
  if (result.policyId !== bundle.policyId || result.policyVersion !== bundle.version || result.policyDigest !== bundle.digest) throw new PolicyGovernanceError("POLICY_INVALID_RESULT", "Provider result is not bound to the resolved policy bundle");
  if ((result.outcome === "ALLOW" || result.outcome === "DENY") && result.ruleId === undefined && result.decisionId === undefined) throw new PolicyGovernanceError("POLICY_INVALID_RESULT", "Explicit provider decisions require a rule or decision reference");
  if (result.ruleId !== undefined) nonEmpty("ruleId", result.ruleId);
  if (result.decisionId !== undefined) nonEmpty("decisionId", result.decisionId);
}

function decision(request: NormalizedPolicyRequest, bundle: PolicyBundle, result: ExternalPolicyResult, effect: GovernanceEffect, ruleId: string, reason: string, failureCode?: PolicyGovernanceErrorCode): PolicyDecision {
  const base = { effect, policyId: bundle.policyId, policyVersion: bundle.version, policyDigest: bundle.digest, requestDigest: request.requestDigest, ruleId, reason, provider: result.provider, providerVersion: result.providerVersion, ...(result.decisionId === undefined ? {} : { providerDecisionId: result.decisionId }), ...(failureCode === undefined ? {} : { failureCode }) };
  const decisionId = digest(base);
  return { effect, evidence: { ...base, decisionId, decidedAt: request.at, ...(bundle.expiresAt === undefined ? {} : { validUntil: bundle.expiresAt }) } };
}

export interface FederatedPolicyContext { originDomain?: string; peerId?: string; requestedCapability?: string; negotiatedCapability?: string; remotePolicyAssertion?: string; }

export class PolicyGovernance {
  private activeEvaluations = 0;
  constructor(private readonly registry: PolicyRegistry, private readonly adapter: PolicyDecisionAdapter, private readonly limits: PolicyGovernanceLimits, private readonly ledger: PolicyDecisionLedger = new InMemoryPolicyDecisionLedger()) {
    positive("maxPolicyBytes", limits.maxPolicyBytes); positive("maxRules", limits.maxRules); positive("maxContextEntries", limits.maxContextEntries); positive("maxContextBytes", limits.maxContextBytes); positive("maxVersionsPerPolicy", limits.maxVersionsPerPolicy); positive("maxConcurrentEvaluations", limits.maxConcurrentEvaluations);
  }
  async evaluate(request: PolicyRequest, policyId: string, version?: string): Promise<PolicyDecision> { return this.evaluateInternal(request, policyId, version); }
  async evaluateFederated(request: PolicyRequest, policyId: string, federation: FederatedPolicyContext, version?: string): Promise<PolicyDecision> {
    const context = { ...(request.context ?? {}), ...(federation.originDomain === undefined ? {} : { federationOrigin: federation.originDomain }), ...(federation.peerId === undefined ? {} : { federationPeer: federation.peerId }), ...(federation.requestedCapability === undefined ? {} : { federationRequestedCapability: federation.requestedCapability }), ...(federation.negotiatedCapability === undefined ? {} : { negotiatedCapability: federation.negotiatedCapability }), ...(federation.remotePolicyAssertion === undefined ? {} : { remotePolicyAssertion: federation.remotePolicyAssertion }) };
    return this.evaluateInternal({ ...request, context }, policyId, version);
  }
  decisions(): PolicyDecision[] { return this.ledger.all(); }

  private async evaluateInternal(input: PolicyRequest, policyId: string, version?: string): Promise<PolicyDecision> {
    const request = normalizePolicyRequest(input); const bundle = this.registry.resolve(policyId, request.at, version);
    const policyBytes = bytes(stableStringify(canonical(bundle))); const contextEntries = request.context === undefined ? 0 : Object.keys(request.context).length;
    if (policyBytes > this.limits.maxPolicyBytes || bundle.rules.length > this.limits.maxRules || contextEntries > this.limits.maxContextEntries || request.contextBytes > this.limits.maxContextBytes) throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", `Policy/evaluation resource limits exceeded for ${policyId}@${bundle.version}`);
    if (this.activeEvaluations >= this.limits.maxConcurrentEvaluations) throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", "Maximum concurrent policy evaluations exceeded");

    const { deny, allow } = localRules(bundle, request);
    if (deny !== undefined) {
      const result: ExternalPolicyResult = { outcome: "DENY", provider: "sif-local-governance", providerVersion: "v1", ruleId: deny.id, reason: deny.reason, decisionId: digest({ policyId: bundle.policyId, version: bundle.version, policyDigest: bundle.digest, requestDigest: request.requestDigest, ruleId: deny.id }), policyId: bundle.policyId, policyVersion: bundle.version, policyDigest: bundle.digest };
      const value = decision(request, bundle, result, "DENY", deny.id, deny.reason); this.ledger.append(value); return cloneDecision(value);
    }
    if (allow === undefined) {
      const result: ExternalPolicyResult = { outcome: "DENY", provider: "sif-local-governance", providerVersion: "v1", ruleId: "default-deny", reason: "No local allow rule admits this request", decisionId: digest({ policyId: bundle.policyId, version: bundle.version, policyDigest: bundle.digest, requestDigest: request.requestDigest, ruleId: "default-deny" }), policyId: bundle.policyId, policyVersion: bundle.version, policyDigest: bundle.digest };
      const value = decision(request, bundle, result, "DENY", "default-deny", result.reason!); this.ledger.append(value); return cloneDecision(value);
    }

    this.activeEvaluations += 1;
    try {
      const result = await this.adapter.evaluate(request, bundle); validateProviderResult(result, bundle);
      if (result.outcome === "ALLOW") { const value = decision(request, bundle, result, "ALLOW", allow.id, allow.reason); this.ledger.append(value); return cloneDecision(value); }
      if (result.outcome === "DENY") { const ruleId = result.ruleId ?? allow.id; const value = decision(request, bundle, result, "DENY", ruleId, result.reason ?? "Provider denied the request"); this.ledger.append(value); return cloneDecision(value); }
      const code = result.outcome === "PROVIDER_UNAVAILABLE" ? "POLICY_PROVIDER_UNAVAILABLE" : result.outcome === "PROVIDER_INCOMPATIBLE" ? "POLICY_PROVIDER_INCOMPATIBLE" : "POLICY_INVALID_RESULT";
      const value = decision(request, bundle, result, "INDETERMINATE", result.ruleId ?? allow.id, result.reason ?? `Provider returned ${result.outcome}`, code); this.ledger.append(value); return cloneDecision(value);
    } finally { this.activeEvaluations -= 1; }
  }
}
