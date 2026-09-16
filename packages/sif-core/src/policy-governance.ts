import { digest, stableStringify } from "./core.js";

export type PolicyLifecycle = "registered" | "active" | "retired";
export type GovernanceEffect = "ALLOW" | "DENY" | "INDETERMINATE";
export type PolicyProviderOutcome =
  | "ALLOW"
  | "DENY"
  | "INDETERMINATE"
  | "INVALID_RESULT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_INCOMPATIBLE";

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
  private readonly records: PolicyDecision[] = [];

  append(decision: PolicyDecision): void {
    this.records.push(cloneDecision(decision));
  }

  all(): PolicyDecision[] {
    return this.records.map(cloneDecision);
  }
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

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) {
    throw new PolicyGovernanceError("POLICY_INVALID", `${name} must not be empty`);
  }
}

function assertIso(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new PolicyGovernanceError("POLICY_INVALID", `${name} must be a valid ISO date`);
  }
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", `${name} must be a positive safe integer`);
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
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

function cloneDecision(decision: PolicyDecision): PolicyDecision {
  return {
    effect: decision.effect,
    evidence: { ...decision.evidence },
  };
}

function assertJsonValue(value: unknown, path: string): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new PolicyGovernanceError("POLICY_INVALID", `${path} must contain only finite numbers`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertJsonValue(value[index], `${path}[${index}]`);
    }
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      assertNonEmpty(`${path} key`, key);
      assertJsonValue(nested, `${path}.${key}`);
    }
    return;
  }
  throw new PolicyGovernanceError("POLICY_INVALID", `${path} contains an unsupported value type`);
}

export function computePolicyDigest(content: PolicyBundleContent): string {
  return digest(stableStringify(content));
}

function canonicalPolicyContent(bundle: PolicyBundle): PolicyBundleContent {
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

function validateRule(rule: PolicyRule, index: number): void {
  assertNonEmpty(`rules[${index}].id`, rule.id);
  assertNonEmpty(`rules[${index}].reason`, rule.reason);
  if (rule.subjectId !== undefined) assertNonEmpty(`rules[${index}].subjectId`, rule.subjectId);
  if (rule.capabilityId !== undefined) assertNonEmpty(`rules[${index}].capabilityId`, rule.capabilityId);
  if (rule.scopePrefix !== undefined) assertNonEmpty(`rules[${index}].scopePrefix`, rule.scopePrefix);
  if (rule.contextEquals !== undefined) {
    for (const [key, value] of Object.entries(rule.contextEquals)) {
      assertNonEmpty(`rules[${index}].contextEquals key`, key);
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new PolicyGovernanceError("POLICY_INVALID", `rules[${index}].contextEquals contains a non-finite number`);
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
  if (bundle.rules.length === 0) {
    throw new PolicyGovernanceError("POLICY_INVALID", "Policy bundle must contain at least one rule");
  }
  const ids = new Set<string>();
  for (let index = 0; index < bundle.rules.length; index += 1) {
    const rule = bundle.rules[index]!;
    validateRule(rule, index);
    if (ids.has(rule.id)) {
      throw new PolicyGovernanceError("POLICY_INVALID", `Duplicate policy rule: ${rule.id}`);
    }
    ids.add(rule.id);
  }
  if (computePolicyDigest(canonicalPolicyContent(bundle)) !== bundle.digest) {
    throw new PolicyGovernanceError("POLICY_INTEGRITY_FAILURE", `Policy digest mismatch for ${bundle.policyId}@${bundle.version}`);
  }
}

interface PolicyRecord {
  bundle: PolicyBundle;
  activatedAt?: string;
  retiredAt?: string;
}

function activeIntervalAt(record: PolicyRecord, at: string): boolean {
  const timestamp = Date.parse(at);
  if (timestamp < Date.parse(record.bundle.effectiveFrom)) return false;
  if (record.bundle.expiresAt !== undefined && timestamp >= Date.parse(record.bundle.expiresAt)) return false;
  if (record.activatedAt === undefined) return false;
  if (timestamp < Date.parse(record.activatedAt)) return false;
  if (record.retiredAt !== undefined && timestamp >= Date.parse(record.retiredAt)) return false;
  return true;
}

export interface PolicyRegistryOptions {
  maxVersionsPerPolicy?: number;
}

export class PolicyRegistry {
  private readonly records = new Map<string, PolicyRecord>();
  private readonly lifecycleEvidence: Array<{
    policyId: string;
    version: string;
    action: "REGISTER" | "ACTIVATE" | "RETIRE";
    at: string;
    provenanceId: string;
  }> = [];
  private readonly maxVersionsPerPolicy: number;

  constructor(options: PolicyRegistryOptions = {}) {
    this.maxVersionsPerPolicy = options.maxVersionsPerPolicy ?? 64;
    assertPositiveInteger("maxVersionsPerPolicy", this.maxVersionsPerPolicy);
  }

  register(bundle: PolicyBundle): void {
    validateBundle(bundle);
    if (bundle.lifecycle !== "registered") {
      throw new PolicyGovernanceError("POLICY_INVALID", "New policy versions must start in registered lifecycle state");
    }
    const key = this.key(bundle.policyId, bundle.version);
    const existing = this.records.get(key);
    if (existing) {
      if (existing.bundle.digest !== bundle.digest) {
        throw new PolicyGovernanceError("POLICY_INTEGRITY_FAILURE", `Policy version is immutable: ${key}`);
      }
      return;
    }
    const count = this.list(bundle.policyId).length;
    if (count >= this.maxVersionsPerPolicy) {
      throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", `Policy version retention limit reached for ${bundle.policyId}`);
    }
    this.records.set(key, { bundle: cloneBundle(bundle) });
    this.lifecycleEvidence.push({
      policyId: bundle.policyId,
      version: bundle.version,
      action: "REGISTER",
      at: bundle.effectiveFrom,
      provenanceId: bundle.provenanceId,
    });
  }

  activate(policyId: string, version: string, at: string): PolicyBundle {
    assertNonEmpty("policyId", policyId);
    assertNonEmpty("version", version);
    assertIso("at", at);
    const record = this.records.get(this.key(policyId, version));
    if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
    if (record.bundle.lifecycle === "retired") {
      throw new PolicyGovernanceError("POLICY_RETIRED", `Policy is retired: ${policyId}@${version}`);
    }
    const timestamp = Date.parse(at);
    if (timestamp < Date.parse(record.bundle.effectiveFrom) || (record.bundle.expiresAt !== undefined && timestamp >= Date.parse(record.bundle.expiresAt))) {
      throw new PolicyGovernanceError("POLICY_EXPIRED", `Policy is outside its effective window: ${policyId}@${version}`);
    }
    if (record.activatedAt !== undefined) return cloneBundle({ ...record.bundle, lifecycle: "active" });
    const overlap = [...this.records.values()].find((candidate) =>
      candidate.bundle.policyId === policyId && candidate.bundle.version !== version && activeIntervalAt(candidate, at));
    if (overlap) {
      throw new PolicyGovernanceError("POLICY_AMBIGUOUS", `Another active policy version overlaps at ${at}: ${overlap.bundle.version}`);
    }
    record.activatedAt = at;
    record.bundle = { ...record.bundle, lifecycle: "active" };
    this.lifecycleEvidence.push({ policyId, version, action: "ACTIVATE", at, provenanceId: record.bundle.provenanceId });
    return cloneBundle(record.bundle);
  }

  retire(policyId: string, version: string, at: string): PolicyBundle {
    assertIso("at", at);
    const record = this.records.get(this.key(policyId, version));
    if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
    if (record.bundle.lifecycle === "retired") return cloneBundle(record.bundle);
    if (record.activatedAt === undefined) {
      throw new PolicyGovernanceError("POLICY_INVALID", `Registered policy cannot be retired before activation: ${policyId}@${version}`);
    }
    if (Date.parse(at) < Date.parse(record.activatedAt)) {
      throw new PolicyGovernanceError("POLICY_INVALID", "Retirement time must not precede activation time");
    }
    record.retiredAt = at;
    record.bundle = { ...record.bundle, lifecycle: "retired" };
    this.lifecycleEvidence.push({ policyId, version, action: "RETIRE", at, provenanceId: record.bundle.provenanceId });
    return cloneBundle(record.bundle);
  }

  resolve(policyId: string, at: string, version?: string): PolicyBundle {
    assertNonEmpty("policyId", policyId);
    assertIso("at", at);
    if (version !== undefined) {
      const record = this.records.get(this.key(policyId, version));
      if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
      if (!activeIntervalAt(record, at)) {
        if (record.bundle.lifecycle === "retired") throw new PolicyGovernanceError("POLICY_RETIRED", `Policy version is not active at ${at}: ${policyId}@${version}`);
        throw new PolicyGovernanceError("POLICY_EXPIRED", `Policy version is not active at ${at}: ${policyId}@${version}`);
      }
      return cloneBundle(record.bundle);
    }
    const candidates = [...this.records.values()].filter((record) => record.bundle.policyId === policyId && activeIntervalAt(record, at));
    if (candidates.length === 0) {
      const known = this.list(policyId);
      if (known.length === 0) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `No policy exists for ${policyId}`);
      const hasRetired = known.some((bundle) => bundle.lifecycle === "retired");
      const hasConfigured = known.some((bundle) => bundle.lifecycle === "registered");
      if (known.every((bundle) => bundle.lifecycle === "retired")) {
        throw new PolicyGovernanceError("POLICY_RETIRED", `All policy versions are retired for ${policyId}`);
      }
      if (!hasConfigured && hasRetired) throw new PolicyGovernanceError("POLICY_RETIRED", `No active policy version at ${at}: ${policyId}`);
      if (known.every((bundle) => bundle.expiresAt !== undefined && Date.parse(bundle.expiresAt) <= Date.parse(at))) {
        throw new PolicyGovernanceError("POLICY_EXPIRED", `No policy version is active at ${at}: ${policyId}`);
      }
      throw new PolicyGovernanceError("POLICY_NOT_FOUND", `No active policy version at ${at}: ${policyId}`);
    }
    if (candidates.length > 1) {
      throw new PolicyGovernanceError("POLICY_AMBIGUOUS", `Multiple policy versions are active at ${at}: ${policyId}`);
    }
    return cloneBundle(candidates[0]!.bundle);
  }

  get(policyId: string, version: string): PolicyBundle {
    const record = this.records.get(this.key(policyId, version));
    if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
    return cloneBundle(record.bundle);
  }

  list(policyId?: string): PolicyBundle[] {
    return [...this.records.values()]
      .filter((record) => policyId === undefined || record.bundle.policyId === policyId)
      .sort((a, b) => {
        const left = `${a.bundle.policyId}\u0000${a.bundle.version}`;
        const right = `${b.bundle.policyId}\u0000${b.bundle.version}`;
        return left < right ? -1 : left > right ? 1 : 0;
      })
      .map((record) => cloneBundle(record.bundle));
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

function localRuleOutcome(bundle: PolicyBundle, request: NormalizedPolicyRequest): { deny?: PolicyRule; allow?: PolicyRule } {
  const matching = bundle.rules.filter((rule) => matchesRule(rule, request));
  return {
    deny: matching.find((rule) => rule.effect === "DENY"),
    allow: matching.find((rule) => rule.effect === "ALLOW"),
  };
}

export class LocalDeterministicPolicyAdapter implements PolicyDecisionAdapter {
  constructor(readonly providerVersion = "builtin-v1") {}

  async evaluate(request: NormalizedPolicyRequest, bundle: PolicyBundle): Promise<ExternalPolicyResult> {
    const { deny, allow } = localRuleOutcome(bundle, request);
    const selected = deny ?? allow;
    if (!selected) {
      return {
        outcome: "DENY",
        provider: "sif-local-policy",
        providerVersion: this.providerVersion,
        decisionId: digest({ policyId: bundle.policyId, policyVersion: bundle.version, policyDigest: bundle.digest, requestDigest: request.requestDigest, outcome: "DENY", ruleId: "default-deny" }),
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
      decisionId: digest({ policyId: bundle.policyId, policyVersion: bundle.version, policyDigest: bundle.digest, requestDigest: request.requestDigest, outcome: selected.effect, ruleId: selected.id }),
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
  if (request.context !== undefined) assertJsonValue(request.context, "context");
  const context = request.context === undefined ? undefined : structuredClone(request.context);
  const normalized: PolicyRequest = {
    subjectId: request.subjectId,
    capabilityId: request.capabilityId,
    scope: request.scope,
    at: new Date(request.at).toISOString(),
    ...(context === undefined ? {} : { context }),
  };
  const contextBytes = context === undefined ? 0 : byteLength(stableStringify(context));
  return { ...normalized, requestDigest: digest(normalized), contextBytes };
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
  if ((result.outcome === "ALLOW" || result.outcome === "DENY") && result.ruleId === undefined && result.decisionId === undefined) {
    throw new PolicyGovernanceError("POLICY_INVALID_RESULT", "Explicit provider decisions require a rule or decision reference");
  }
  if (result.ruleId !== undefined) assertNonEmpty("ruleId", result.ruleId);
  if (result.reason !== undefined) assertNonEmpty("reason", result.reason);
  if (result.decisionId !== undefined) assertNonEmpty("decisionId", result.decisionId);
}

function decisionIdentity(args: {
  effect: GovernanceEffect;
  policyId: string;
  policyVersion: string;
  policyDigest: string;
  requestDigest: string;
  ruleId: string;
  provider: string;
  providerVersion: string;
  providerDecisionId?: string;
  failureCode?: PolicyGovernanceErrorCode;
}): string {
  return digest(args);
}

function outcomeDecision(
  request: NormalizedPolicyRequest,
  bundle: PolicyBundle,
  result: ExternalPolicyResult,
  effect: GovernanceEffect,
  ruleId: string,
  reason: string,
  failureCode?: PolicyGovernanceErrorCode,
): PolicyDecision {
  const evidenceBase = {
    effect,
    policyId: bundle.policyId,
    policyVersion: bundle.version,
    policyDigest: bundle.digest,
    requestDigest: request.requestDigest,
    ruleId,
    reason,
    provider: result.provider,
    providerVersion: result.providerVersion,
    ...(result.decisionId === undefined ? {} : { providerDecisionId: result.decisionId }),
    ...(failureCode === undefined ? {} : { failureCode }),
  };
  const decisionId = decisionIdentity({
    effect,
    policyId: bundle.policyId,
    policyVersion: bundle.version,
    policyDigest: bundle.digest,
    requestDigest: request.requestDigest,
    ruleId,
    provider: result.provider,
    providerVersion: result.providerVersion,
    ...(result.decisionId === undefined ? {} : { providerDecisionId: result.decisionId }),
    ...(failureCode === undefined ? {} : { failureCode }),
  });
  const evidence: PolicyDecisionEvidence = {
    decisionId,
    ...evidenceBase,
    decidedAt: request.at,
    ...(bundle.expiresAt === undefined ? {} : { validUntil: bundle.expiresAt }),
  };
  return { effect, evidence };
}

export interface FederatedPolicyContext {
  originDomain?: string;
  peerId?: string;
  requestedCapability?: string;
  remotePolicyAssertion?: string;
  negotiatedCapability?: string;
}

export class PolicyGovernance {
  private activeEvaluations = 0;

  constructor(
    private readonly registry: PolicyRegistry,
    private readonly adapter: PolicyDecisionAdapter,
    private readonly limits: PolicyGovernanceLimits,
    private readonly ledger: PolicyDecisionLedger = new InMemoryPolicyDecisionLedger(),
  ) {
    assertPositiveInteger("maxPolicyBytes", limits.maxPolicyBytes);
    assertPositiveInteger("maxRules", limits.maxRules);
    assertPositiveInteger("maxContextEntries", limits.maxContextEntries);
    assertPositiveInteger("maxContextBytes", limits.maxContextBytes);
    assertPositiveInteger("maxVersionsPerPolicy", limits.maxVersionsPerPolicy);
    assertPositiveInteger("maxConcurrentEvaluations", limits.maxConcurrentEvaluations);
  }

  async evaluate(requestInput: PolicyRequest, policyId: string, version?: string): Promise<PolicyDecision> {
    return this.evaluateInternal(requestInput, policyId, version);
  }

  async evaluateFederated(requestInput: PolicyRequest, policyId: string, federation: FederatedPolicyContext, version?: string): Promise<PolicyDecision> {
    const context = {
      ...(requestInput.context === undefined ? {} : requestInput.context),
      ...(federation.originDomain === undefined ? {} : { federationOrigin: federation.originDomain }),
      ...(federation.peerId === undefined ? {} : { federationPeer: federation.peerId }),
      ...(federation.requestedCapability === undefined ? {} : { federationRequestedCapability: federation.requestedCapability }),
      ...(federation.remotePolicyAssertion === undefined ? {} : { remotePolicyAssertion: federation.remotePolicyAssertion }),
      ...(federation.negotiatedCapability === undefined ? {} : { negotiatedCapability: federation.negotiatedCapability }),
    };
    return this.evaluateInternal({ ...requestInput, context }, policyId, version);
  }

  decisions(): PolicyDecision[] {
    return this.ledger.all();
  }

  private async evaluateInternal(requestInput: PolicyRequest, policyId: string, version?: string): Promise<PolicyDecision> {
    const request = normalizePolicyRequest(requestInput);
    const bundle = this.registry.resolve(policyId, request.at, version);
    const policyBytes = byteLength(stableStringify(canonicalPolicyContent(bundle)));
    if (policyBytes > this.limits.maxPolicyBytes || bundle.rules.length > this.limits.maxRules || request.contextBytes > this.limits.maxContextBytes) {
      throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", `Policy/evaluation resource limits exceeded for ${policyId}@${bundle.version}`);
    }
    const contextEntries = request.context === undefined ? 0 : Object.keys(request.context).length;
    if (contextEntries > this.limits.maxContextEntries) {
      throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", `Context entry limit exceeded for ${policyId}@${bundle.version}`);
    }
    if (this.activeEvaluations >= this.limits.maxConcurrentEvaluations) {
      throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", "Maximum concurrent policy evaluations exceeded");
    }

    const local = localRuleOutcome(bundle, request);
    if (local.deny !== undefined) {
      const result: ExternalPolicyResult = {
        outcome: "DENY",
        provider: "sif-local-governance",
        providerVersion: "v1",
        ruleId: local.deny.id,
        reason: local.deny.reason,
        decisionId: digest({ policyId: bundle.policyId, policyVersion: bundle.version, policyDigest: bundle.digest, requestDigest: request.requestDigest, outcome: "DENY", ruleId: local.deny.id }),
        policyId: bundle.policyId,
        policyVersion: bundle.version,
        policyDigest: bundle.digest,
      };
      const decision = outcomeDecision(request, bundle, result, "DENY", local.deny.id, local.deny.reason);
      this.ledger.append(decision);
      return cloneDecision(decision);
    }

    if (local.allow === undefined) {
      const result: ExternalPolicyResult = {
        outcome: "DENY",
        provider: "sif-local-governance",
        providerVersion: "v1",
        ruleId: "default-deny",
        reason: "No local allow rule admits this request",
        decisionId: digest({ policyId: bundle.policyId, policyVersion: bundle.version, policyDigest: bundle.digest, requestDigest: request.requestDigest, outcome: "DENY", ruleId: "default-deny" }),
        policyId: bundle.policyId,
        policyVersion: bundle.version,
        policyDigest: bundle.digest,
      };
      const decision = outcomeDecision(request, bundle, result, "DENY", "default-deny", result.reason!);
      this.ledger.append(decision);
      return cloneDecision(decision);
    }

    this.activeEvaluations += 1;
    try {
      const result = await this.adapter.evaluate(request, bundle);
      validateExternalResult(result, bundle);
      if (result.outcome === "ALLOW") {
        const decision = outcomeDecision(request, bundle, result, "ALLOW", local.allow.id, local.allow.reason);
        this.ledger.append(decision);
        return cloneDecision(decision);
      }
      if (result.outcome === "DENY") {
        const ruleId = result.ruleId ?? local.allow.id;
        const reason = result.reason ?? "Provider denied the request";
        const decision = outcomeDecision(request, bundle, result, "DENY", ruleId, reason);
        this.ledger.append(decision);
        return cloneDecision(decision);
      }
      const failureCode: PolicyGovernanceErrorCode =
        result.outcome === "PROVIDER_UNAVAILABLE" ? "POLICY_PROVIDER_UNAVAILABLE" :
        result.outcome === "PROVIDER_INCOMPATIBLE" ? "POLICY_PROVIDER_INCOMPATIBLE" :
        "POLICY_INVALID_RESULT";
      const reason = result.reason ?? `Provider returned ${result.outcome}`;
      const decision = outcomeDecision(request, bundle, result, "INDETERMINATE", result.ruleId ?? local.allow.id, reason, failureCode);
      this.ledger.append(decision);
      return cloneDecision(decision);
    } finally {
      this.activeEvaluations -= 1;
    }
  }
}
