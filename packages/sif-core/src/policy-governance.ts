import { digest, stableStringify } from "./core.js";

export type PolicyLifecycle = "registered" | "active" | "retired";
export type GovernanceEffect = "ALLOW" | "DENY" | "INDETERMINATE";
export type PolicyProviderOutcome = "ALLOW" | "DENY" | "INDETERMINATE" | "INVALID_RESULT" | "PROVIDER_UNAVAILABLE" | "PROVIDER_INCOMPATIBLE";
export type PolicyPrimitive = string | number | boolean | null;

export interface PolicyRule {
  id: string; effect: Exclude<GovernanceEffect, "INDETERMINATE">; subjectId?: string; capabilityId?: string; scopePrefix?: string;
  contextEquals?: Record<string, PolicyPrimitive>; reason: string;
}
export interface PolicyBundleContent {
  policyId: string; version: string; source: string; provenanceId: string; effectiveFrom: string; expiresAt?: string; rules: PolicyRule[];
}
export interface PolicyBundle extends PolicyBundleContent { digest: string; lifecycle: PolicyLifecycle; }
export interface PolicyRequest { subjectId: string; capabilityId: string; scope: string; at: string; context?: Record<string, unknown>; }
export interface NormalizedPolicyRequest extends PolicyRequest { requestDigest: string; contextBytes: number; }
export interface ExternalPolicyResult {
  outcome: PolicyProviderOutcome; provider: string; providerVersion: string; decisionId?: string; ruleId?: string; reason?: string;
  policyId: string; policyVersion: string; policyDigest: string;
}
export type PolicyGovernanceErrorCode =
  | "POLICY_NOT_FOUND" | "POLICY_AMBIGUOUS" | "POLICY_EXPIRED" | "POLICY_RETIRED" | "POLICY_INVALID"
  | "POLICY_INTEGRITY_FAILURE" | "POLICY_PROVIDER_UNAVAILABLE" | "POLICY_PROVIDER_INCOMPATIBLE"
  | "POLICY_INVALID_RESULT" | "POLICY_RESOURCE_EXHAUSTED" | "POLICY_DENIED";
export interface PolicyDecisionEvidence {
  decisionId: string; effect: GovernanceEffect; policyId: string; policyVersion: string; policyDigest: string; requestDigest: string;
  ruleId: string; reason: string; decidedAt: string; validUntil?: string; provider: string; providerVersion: string;
  providerDecisionId?: string; failureCode?: PolicyGovernanceErrorCode;
}
export interface PolicyDecision { effect: GovernanceEffect; evidence: PolicyDecisionEvidence; }
export interface PolicyDecisionAdapter { evaluate(request: NormalizedPolicyRequest, bundle: PolicyBundle): Promise<ExternalPolicyResult>; }
export interface PolicyDecisionLedger { append(decision: PolicyDecision): void; all(): PolicyDecision[]; }
export interface PolicyGovernanceLimits {
  maxPolicyBytes: number; maxRules: number; maxContextEntries: number; maxContextBytes: number; maxVersionsPerPolicy: number; maxConcurrentEvaluations: number;
}
export interface PolicyRegistryOptions { maxVersionsPerPolicy?: number; }
export interface FederatedPolicyContext {
  originDomain?: string; peerId?: string; requestedCapability?: string; negotiatedCapability?: string; remotePolicyAssertion?: string;
}

export class PolicyGovernanceError extends Error {
  constructor(readonly code: PolicyGovernanceErrorCode, message: string) { super(message); this.name = "PolicyGovernanceError"; }
}

function text(name: string, value: string): void { if (value.length === 0) throw new PolicyGovernanceError("POLICY_INVALID", `${name} must not be empty`); }
function iso(name: string, value: string): void { if (!Number.isFinite(Date.parse(value))) throw new PolicyGovernanceError("POLICY_INVALID", `${name} must be a valid ISO date`); }
function positive(name: string, value: number): void { if (!Number.isSafeInteger(value) || value <= 0) throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", `${name} must be positive`); }
function clone<T>(value: T): T { return structuredClone(value); }
function byteSize(value: unknown): number { return new TextEncoder().encode(stableStringify(value)).byteLength; }
function canonical(bundle: PolicyBundle): PolicyBundleContent {
  return { policyId: bundle.policyId, version: bundle.version, source: bundle.source, provenanceId: bundle.provenanceId, effectiveFrom: bundle.effectiveFrom,
    ...(bundle.expiresAt === undefined ? {} : { expiresAt: bundle.expiresAt }), rules: bundle.rules };
}
export function computePolicyDigest(content: PolicyBundleContent): string { return digest(stableStringify(content)); }

function validateJson(value: unknown, path: string): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new PolicyGovernanceError("POLICY_INVALID", `${path} contains a non-finite number`); return; }
  if (Array.isArray(value)) { value.forEach((x, i) => validateJson(x, `${path}[${i}]`)); return; }
  if (typeof value === "object") { for (const [key, nested] of Object.entries(value as Record<string, unknown>)) { text(`${path} key`, key); validateJson(nested, `${path}.${key}`); } return; }
  throw new PolicyGovernanceError("POLICY_INVALID", `${path} contains unsupported value`);
}
function validateBundle(bundle: PolicyBundle): void {
  text("policyId", bundle.policyId); text("version", bundle.version); text("source", bundle.source); text("provenanceId", bundle.provenanceId); text("digest", bundle.digest); iso("effectiveFrom", bundle.effectiveFrom);
  if (bundle.expiresAt !== undefined) { iso("expiresAt", bundle.expiresAt); if (Date.parse(bundle.expiresAt) <= Date.parse(bundle.effectiveFrom)) throw new PolicyGovernanceError("POLICY_INVALID", "expiresAt must be after effectiveFrom"); }
  if (bundle.rules.length === 0) throw new PolicyGovernanceError("POLICY_INVALID", "Policy bundle must contain at least one rule");
  const ids = new Set<string>();
  bundle.rules.forEach((rule, i) => {
    text(`rules[${i}].id`, rule.id); text(`rules[${i}].reason`, rule.reason);
    if (rule.subjectId !== undefined) text(`rules[${i}].subjectId`, rule.subjectId);
    if (rule.capabilityId !== undefined) text(`rules[${i}].capabilityId`, rule.capabilityId);
    if (rule.scopePrefix !== undefined) text(`rules[${i}].scopePrefix`, rule.scopePrefix);
    if (rule.contextEquals !== undefined) for (const [key, value] of Object.entries(rule.contextEquals)) { text(`rules[${i}].contextEquals key`, key); if (typeof value === "number" && !Number.isFinite(value)) throw new PolicyGovernanceError("POLICY_INVALID", "contextEquals number invalid"); }
    if (ids.has(rule.id)) throw new PolicyGovernanceError("POLICY_INVALID", `Duplicate policy rule: ${rule.id}`);
    ids.add(rule.id);
  });
  if (computePolicyDigest(canonical(bundle)) !== bundle.digest) throw new PolicyGovernanceError("POLICY_INTEGRITY_FAILURE", `Policy digest mismatch for ${bundle.policyId}@${bundle.version}`);
}
interface PolicyRecord { bundle: PolicyBundle; activatedAt?: string; retiredAt?: string; }
function activeAt(record: PolicyRecord, at: string): boolean {
  if (record.activatedAt === undefined) return false;
  const value = Date.parse(at);
  if (value < Date.parse(record.activatedAt) || value < Date.parse(record.bundle.effectiveFrom)) return false;
  if (record.bundle.expiresAt !== undefined && value >= Date.parse(record.bundle.expiresAt)) return false;
  if (record.retiredAt !== undefined && value >= Date.parse(record.retiredAt)) return false;
  return true;
}

export class PolicyRegistry {
  private readonly records = new Map<string, PolicyRecord>();
  private readonly lifecycleEntries: Array<{ policyId: string; version: string; action: "REGISTER" | "ACTIVATE" | "RETIRE"; at: string; provenanceId: string }> = [];
  private readonly maxVersions: number;
  constructor(options: PolicyRegistryOptions = {}) { this.maxVersions = options.maxVersionsPerPolicy ?? 64; positive("maxVersionsPerPolicy", this.maxVersions); }
  register(bundle: PolicyBundle): void {
    validateBundle(bundle); if (bundle.lifecycle !== "registered") throw new PolicyGovernanceError("POLICY_INVALID", "New policy versions must start registered");
    const key = this.key(bundle.policyId, bundle.version); const existing = this.records.get(key);
    if (existing) { if (existing.bundle.digest !== bundle.digest) throw new PolicyGovernanceError("POLICY_INTEGRITY_FAILURE", `Policy version is immutable: ${key}`); return; }
    if (this.list(bundle.policyId).length >= this.maxVersions) throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED", `Policy version retention limit reached for ${bundle.policyId}`);
    this.records.set(key, { bundle: clone(bundle) }); this.lifecycleEntries.push({ policyId: bundle.policyId, version: bundle.version, action: "REGISTER", at: bundle.effectiveFrom, provenanceId: bundle.provenanceId });
  }
  activate(policyId: string, version: string, at: string): PolicyBundle {
    text("policyId", policyId); text("version", version); iso("at", at); const record = this.records.get(this.key(policyId, version));
    if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
    if (record.bundle.lifecycle === "retired") throw new PolicyGovernanceError("POLICY_RETIRED", `Policy is retired: ${policyId}@${version}`);
    if (record.activatedAt !== undefined) return clone(record.bundle);
    const t = Date.parse(at); if (t < Date.parse(record.bundle.effectiveFrom) || (record.bundle.expiresAt !== undefined && t >= Date.parse(record.bundle.expiresAt))) throw new PolicyGovernanceError("POLICY_EXPIRED", `Policy is outside its effective window: ${policyId}@${version}`);
    const overlap = [...this.records.values()].find(x => x.bundle.policyId === policyId && x.bundle.version !== version && activeAt(x, at));
    if (overlap) throw new PolicyGovernanceError("POLICY_AMBIGUOUS", `Another active policy version overlaps at ${at}: ${overlap.bundle.version}`);
    record.activatedAt = at; record.bundle = { ...record.bundle, lifecycle: "active" }; this.lifecycleEntries.push({ policyId, version, action: "ACTIVATE", at, provenanceId: record.bundle.provenanceId }); return clone(record.bundle);
  }
  retire(policyId: string, version: string, at: string): PolicyBundle {
    iso("at", at); const record = this.records.get(this.key(policyId, version)); if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
    if (record.bundle.lifecycle === "retired") return clone(record.bundle); if (record.activatedAt === undefined) throw new PolicyGovernanceError("POLICY_INVALID", "Registered policy cannot be retired before activation");
    if (Date.parse(at) < Date.parse(record.activatedAt)) throw new PolicyGovernanceError("POLICY_INVALID", "Retirement time must not precede activation");
    record.retiredAt = at; record.bundle = { ...record.bundle, lifecycle: "retired" }; this.lifecycleEntries.push({ policyId, version, action: "RETIRE", at, provenanceId: record.bundle.provenanceId }); return clone(record.bundle);
  }
  resolve(policyId: string, at: string, version?: string): PolicyBundle {
    text("policyId", policyId); iso("at", at);
    if (version !== undefined) {
      const record = this.records.get(this.key(policyId, version)); if (!record) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `Policy version not found: ${policyId}@${version}`);
      if (!activeAt(record, at)) { if (record.bundle.lifecycle === "retired") throw new PolicyGovernanceError("POLICY_RETIRED", `Policy version is not active at ${at}: ${policyId}@${version}`); throw new PolicyGovernanceError("POLICY_EXPIRED", `Policy version is not active at ${at}: ${policyId}@${version}`); }
      return clone(record.bundle);
    }
    const matches = [...this.records.values()].filter(r => r.bundle.policyId === policyId && activeAt(r, at));
    if (matches.length === 1) return clone(matches[0]!.bundle); if (matches.length > 1) throw new PolicyGovernanceError("POLICY_AMBIGUOUS", `Multiple policy versions are active at ${at}: ${policyId}`);
    const known = this.list(policyId); if (known.length === 0) throw new PolicyGovernanceError("POLICY_NOT_FOUND", `No policy exists for ${policyId}`);
    if (known.every(b => b.lifecycle === "retired")) throw new PolicyGovernanceError("POLICY_RETIRED", `All policy versions are retired for ${policyId}`);
    if (known.every(b => b.expiresAt !== undefined && Date.parse(b.expiresAt) <= Date.parse(at))) throw new PolicyGovernanceError("POLICY_EXPIRED", `No policy version is active at ${at}: ${policyId}`);
    throw new PolicyGovernanceError("POLICY_NOT_FOUND", `No active policy version at ${at}: ${policyId}`);
  }
  get(policyId:string,version:string):PolicyBundle{const r=this.records.get(this.key(policyId,version));if(!r)throw new PolicyGovernanceError("POLICY_NOT_FOUND",`Policy version not found: ${policyId}@${version}`);return clone(r.bundle);}
  list(policyId?:string):PolicyBundle[]{return[...this.records.values()].filter(r=>policyId===undefined||r.bundle.policyId===policyId).sort((a,b)=>`${a.bundle.policyId}\u0000${a.bundle.version}`.localeCompare(`${b.bundle.policyId}\u0000${b.bundle.version}`)).map(r=>clone(r.bundle));}
  lifecycleLog(){return clone(this.lifecycleEntries);}
  private key(id:string,v:string){return `${id}\u0000${v}`;}
}

function matches(rule:PolicyRule,request:NormalizedPolicyRequest):boolean{if(rule.subjectId!==undefined&&rule.subjectId!==request.subjectId)return false;if(rule.capabilityId!==undefined&&rule.capabilityId!==request.capabilityId)return false;if(rule.scopePrefix!==undefined&&request.scope!==rule.scopePrefix&&!request.scope.startsWith(`${rule.scopePrefix}/`))return false;if(rule.contextEquals!==undefined)for(const[key,value]of Object.entries(rule.contextEquals))if(request.context?.[key]!==value)return false;return true;}
function localRules(bundle:PolicyBundle,request:NormalizedPolicyRequest){const found=bundle.rules.filter(r=>matches(r,request));return{deny:found.find(r=>r.effect==="DENY"),allow:found.find(r=>r.effect==="ALLOW")};}

export class LocalDeterministicPolicyAdapter implements PolicyDecisionAdapter{
  constructor(readonly providerVersion="builtin-v1"){}
  async evaluate(request:NormalizedPolicyRequest,bundle:PolicyBundle):Promise<ExternalPolicyResult>{const{deny,allow}=localRules(bundle,request);const selected=deny??allow;if(selected===undefined)return{outcome:"DENY",provider:"sif-local-policy",providerVersion:this.providerVersion,decisionId:digest({policyId:bundle.policyId,version:bundle.version,policyDigest:bundle.digest,requestDigest:request.requestDigest,ruleId:"default-deny"}),ruleId:"default-deny",reason:"No matching allow rule",policyId:bundle.policyId,policyVersion:bundle.version,policyDigest:bundle.digest};return{outcome:selected.effect,provider:"sif-local-policy",providerVersion:this.providerVersion,decisionId:digest({policyId:bundle.policyId,version:bundle.version,policyDigest:bundle.digest,requestDigest:request.requestDigest,ruleId:selected.id,outcome:selected.effect}),ruleId:selected.id,reason:selected.reason,policyId:bundle.policyId,policyVersion:bundle.version,policyDigest:bundle.digest};}
}
export function normalizePolicyRequest(input:PolicyRequest):NormalizedPolicyRequest{ text("subjectId",input.subjectId);text("capabilityId",input.capabilityId);text("scope",input.scope);iso("at",input.at);if(input.context!==undefined)validateJson(input.context,"context");const context=input.context===undefined?undefined:clone(input.context);const normalized:PolicyRequest={subjectId:input.subjectId,capabilityId:input.capabilityId,scope:input.scope,at:new Date(input.at).toISOString(),...(context===undefined?{}:{context})};return{...normalized,requestDigest:digest(normalized),contextBytes:context===undefined?0:byteSize(context)};}
function validateProviderResult(result:ExternalPolicyResult,bundle:PolicyBundle):void{text("provider",result.provider);text("providerVersion",result.providerVersion);if(result.policyId!==bundle.policyId||result.policyVersion!==bundle.version||result.policyDigest!==bundle.digest)throw new PolicyGovernanceError("POLICY_INVALID_RESULT","Provider result is not bound to the resolved policy bundle");if((result.outcome==="ALLOW"||result.outcome==="DENY")&&result.ruleId===undefined&&result.decisionId===undefined)throw new PolicyGovernanceError("POLICY_INVALID_RESULT","Explicit provider decision needs reference");if(result.ruleId!==undefined)text("ruleId",result.ruleId);if(result.decisionId!==undefined)text("decisionId",result.decisionId);}
function makeDecision(q:NormalizedPolicyRequest,b:PolicyBundle,x:ExternalPolicyResult,e:GovernanceEffect,ruleId:string,reason:string,code?:PolicyGovernanceErrorCode):PolicyDecision{const base={effect:e,policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest,requestDigest:q.requestDigest,ruleId,reason,provider:x.provider,providerVersion:x.providerVersion,...(x.decisionId===undefined?{}:{providerDecisionId:x.decisionId}),...(code===undefined?{}:{failureCode:code})};const evidence={...base,decisionId:digest(base),decidedAt:q.at,...(b.expiresAt===undefined?{}:{validUntil:b.expiresAt})};return{effect:e,evidence};}

export class InMemoryPolicyDecisionLedger implements PolicyDecisionLedger{private readonly entries:PolicyDecision[]=[];append(decision:PolicyDecision):void{this.entries.push(clone(decision));}all():PolicyDecision[]{return this.entries.map(x=>clone(x));}}
export class PolicyGovernance{
  private activeEvaluations=0;
  constructor(private readonly registry:PolicyRegistry,private readonly adapter:PolicyDecisionAdapter,private readonly limits:PolicyGovernanceLimits,private readonly ledger:PolicyDecisionLedger=new InMemoryPolicyDecisionLedger()){positive("maxPolicyBytes",limits.maxPolicyBytes);positive("maxRules",limits.maxRules);positive("maxContextEntries",limits.maxContextEntries);positive("maxContextBytes",limits.maxContextBytes);positive("maxVersionsPerPolicy",limits.maxVersionsPerPolicy);positive("maxConcurrentEvaluations",limits.maxConcurrentEvaluations);}
  async evaluate(request:PolicyRequest,policyId:string,version?:string):Promise<PolicyDecision>{return this.evaluateInternal(request,policyId,version);}
  async evaluateFederated(request:PolicyRequest,policyId:string,federation:FederatedPolicyContext,version?:string):Promise<PolicyDecision>{return this.evaluateInternal({...request,context:{...(request.context??{}),...(federation.originDomain===undefined?{}:{federationOrigin:federation.originDomain}),...(federation.peerId===undefined?{}:{federationPeer:federation.peerId}),...(federation.requestedCapability===undefined?{}:{federationRequestedCapability:federation.requestedCapability}),...(federation.negotiatedCapability===undefined?{}:{negotiatedCapability:federation.negotiatedCapability}),...(federation.remotePolicyAssertion===undefined?{}:{remotePolicyAssertion:federation.remotePolicyAssertion})}},policyId,version);}
  decisions():PolicyDecision[]{return this.ledger.all();}
  private async evaluateInternal(input:PolicyRequest,policyId:string,version?:string):Promise<PolicyDecision>{
    const q=normalizePolicyRequest(input);const b=this.registry.resolve(policyId,q.at,version);if(this.registry.list(policyId).length>this.limits.maxVersionsPerPolicy)throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED",`Policy version retention limit exceeded for ${policyId}`);
    const pbytes=byteSize(canonical(b));const entries=q.context===undefined?0:Object.keys(q.context).length;if(pbytes>this.limits.maxPolicyBytes||b.rules.length>this.limits.maxRules||entries>this.limits.maxContextEntries||q.contextBytes>this.limits.maxContextBytes)throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED","Policy/evaluation resource limits exceeded");
    if(this.activeEvaluations>=this.limits.maxConcurrentEvaluations)throw new PolicyGovernanceError("POLICY_RESOURCE_EXHAUSTED","Maximum concurrent policy evaluations exceeded");
    const{deny,allow}=localRules(b,q);if(deny!==undefined){const x:ExternalPolicyResult={outcome:"DENY",provider:"sif-local-governance",providerVersion:"v1",ruleId:deny.id,reason:deny.reason,policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest};const d=makeDecision(q,b,x,"DENY",deny.id,deny.reason);this.ledger.append(d);return clone(d);}
    if(allow===undefined){const x:ExternalPolicyResult={outcome:"DENY",provider:"sif-local-governance",providerVersion:"v1",ruleId:"default-deny",reason:"No local allow rule admits this request",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest};const d=makeDecision(q,b,x,"DENY","default-deny",x.reason);this.ledger.append(d);return clone(d);}
    this.activeEvaluations+=1;try{const x=await this.adapter.evaluate(q,b);validateProviderResult(x,b);if(x.outcome==="ALLOW"){const d=makeDecision(q,b,x,"ALLOW",x.ruleId??allow.id,x.reason??allow.reason);this.ledger.append(d);return clone(d);}if(x.outcome==="DENY"){const d=makeDecision(q,b,x,"DENY",x.ruleId??allow.id,x.reason??"Provider denied the request");this.ledger.append(d);return clone(d);}const code:PolicyGovernanceErrorCode=x.outcome==="PROVIDER_UNAVAILABLE"?"POLICY_PROVIDER_UNAVAILABLE":x.outcome==="PROVIDER_INCOMPATIBLE"?"POLICY_PROVIDER_INCOMPATIBLE":"POLICY_INVALID_RESULT";const d=makeDecision(q,b,x,"INDETERMINATE",x.ruleId??allow.id,x.reason??`Provider returned ${x.outcome}`,code);this.ledger.append(d);return clone(d);}finally{this.activeEvaluations-=1;}
  }
}
