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
  type PolicyBundle,
  type PolicyDecisionAdapter,
  type PolicyGovernanceErrorCode,
} from "../src/index.js";

const T0="2026-09-16T00:00:00.000Z";
const T1="2026-09-17T00:00:00.000Z";
const T2="2026-09-18T00:00:00.000Z";

function bundle(overrides: Partial<PolicyBundle> = {}): PolicyBundle {
  const base: Omit<PolicyBundle,"digest">={
    policyId:"access",version:"1",source:"local",provenanceId:"prov-1",effectiveFrom:T0,expiresAt:T2,
    rules:[
      {id:"allow",effect:"ALLOW",capabilityId:"evidence.read",scopePrefix:"evidence",reason:"allow"},
      {id:"deny",effect:"DENY",capabilityId:"evidence.read",scopePrefix:"evidence/secret",reason:"deny"},
    ],lifecycle:"registered",...overrides,
  };
  const {lifecycle:_lifecycle,...content}=base;
  return {...base,digest:computePolicyDigest(content)};
}
function request(overrides:Partial<{subjectId:string;capabilityId:string;scope:string;at:string;context:Record<string,unknown>}>= {}) {
  return {subjectId:"s1",capabilityId:"evidence.read",scope:"evidence/case",at:T1,...overrides};
}
function limits(overrides:Partial<ConstructorParameters<typeof PolicyGovernance>[2]>={}) {
  return {maxPolicyBytes:100000,maxRules:100,maxContextEntries:20,maxContextBytes:10000,maxVersionsPerPolicy:10,maxConcurrentEvaluations:2,...overrides};
}
function ready(r:PolicyRegistry,b=bundle()):PolicyBundle {r.register(b);return r.activate(b.policyId,b.version,T1);}
function syncCode(action:()=>unknown,expected:PolicyGovernanceErrorCode):void {let error:unknown;try{action();}catch(e:unknown){error=e;}assert.equal(error instanceof PolicyGovernanceError && error.code===expected,true);}
async function asyncCode(action:()=>Promise<unknown>,expected:PolicyGovernanceErrorCode):Promise<void>{let error:unknown;try{await action();}catch(e:unknown){error=e;}assert.equal(error instanceof PolicyGovernanceError && error.code===expected,true);}

// Bundle/lifecycle

test("F4-001 deterministic digest",()=>{const b=bundle();const{digest:_d,lifecycle:_l,...content}=b;assert.equal(b.digest,computePolicyDigest(content));});
test("F4-002 identical duplicate is idempotent",()=>{const r=new PolicyRegistry();const b=bundle();r.register(b);r.register(b);assert.equal(r.list("access").length,1);});
test("F4-003 divergent duplicate fails integrity",()=>{const r=new PolicyRegistry();r.register(bundle());syncCode(()=>r.register(bundle({rules:[{id:"x",effect:"ALLOW",reason:"x"}]})),"POLICY_INTEGRITY_FAILURE");});
test("F4-004 malformed bundle fails closed",()=>{const r=new PolicyRegistry();syncCode(()=>r.register(bundle({rules:[]})),"POLICY_INVALID");});
test("F4-005 activation is explicit",()=>{const r=new PolicyRegistry();r.register(bundle());assert.equal(r.get("access","1").lifecycle,"registered");assert.equal(r.activate("access","1",T1).lifecycle,"active");});
test("F4-006 retirement excludes current resolution",()=>{const r=new PolicyRegistry();ready(r);r.retire("access","1",T2);syncCode(()=>r.resolve("access",T2),"POLICY_RETIRED");});
test("F4-007 overlapping versions fail closed",()=>{const r=new PolicyRegistry();r.register(bundle({version:"1"}));r.register(bundle({version:"2"}));r.activate("access","1",T1);syncCode(()=>r.activate("access","2",T1),"POLICY_AMBIGUOUS");});
test("F4-008 timestamp resolution is historical and deterministic",()=>{const r=new PolicyRegistry();r.register(bundle({version:"1",expiresAt:T1}));r.register(bundle({version:"2",effectiveFrom:T1,rules:[{id:"new",effect:"ALLOW",reason:"new"}]}));r.activate("access","1",T0);r.retire("access","1",T1);r.activate("access","2",T1);assert.equal(r.resolve("access",T0,"1").version,"1");assert.equal(r.resolve("access",T1).version,"2");});
test("F4-009 expired policy rejects activation",()=>{const r=new PolicyRegistry();r.register(bundle({expiresAt:T1}));syncCode(()=>r.activate("access","1",T1),"POLICY_EXPIRED");});
test("F4-010 invalid request identity fails closed",()=>{syncCode(()=>normalizePolicyRequest(request({subjectId:""})),"POLICY_INVALID");});

// Local decisions/provider boundary

test("F4-011 explicit allow",async()=>{const r=new PolicyRegistry();const b=ready(r);const d=await new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits()).evaluate(request(),b.policyId);assert.equal(d.effect,"ALLOW");assert.equal(d.evidence.ruleId,"allow");});
test("F4-012 explicit deny",async()=>{const r=new PolicyRegistry();const b=ready(r);const d=await new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits()).evaluate(request({scope:"evidence/secret/x"}),b.policyId);assert.equal(d.effect,"DENY");assert.equal(d.evidence.ruleId,"deny");});
test("F4-013 default deny",async()=>{const r=new PolicyRegistry();const b=ready(r,bundle({rules:[{id:"other",effect:"ALLOW",capabilityId:"other",reason:"other"}]}));const d=await new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits()).evaluate(request(),b.policyId);assert.equal(d.effect,"DENY");assert.equal(d.evidence.ruleId,"default-deny");});
test("F4-014 deny overrides allow",async()=>{const r=new PolicyRegistry();const b=ready(r,bundle({rules:[{id:"allow",effect:"ALLOW",capabilityId:"evidence.read",scopePrefix:"evidence",reason:"allow"},{id:"deny",effect:"DENY",capabilityId:"evidence.read",scopePrefix:"evidence",reason:"deny"}]}));const d=await new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits()).evaluate(request(),b.policyId);assert.equal(d.effect,"DENY");});
test("F4-015 provider allow attribution",async()=>{const r=new PolicyRegistry();const b=ready(r);const a:PolicyDecisionAdapter={evaluate:async()=>({outcome:"ALLOW",provider:"opa",providerVersion:"1",decisionId:"pd",ruleId:"pr",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest})};const d=await new PolicyGovernance(r,a,limits()).evaluate(request(),b.policyId);assert.equal(d.effect,"ALLOW");assert.equal(d.evidence.providerDecisionId,"pd");});
test("F4-016 provider deny attribution",async()=>{const r=new PolicyRegistry();const b=ready(r);const a:PolicyDecisionAdapter={evaluate:async()=>({outcome:"DENY",provider:"cedar",providerVersion:"1",decisionId:"pd",ruleId:"pr",reason:"no",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest})};const d=await new PolicyGovernance(r,a,limits()).evaluate(request(),b.policyId);assert.equal(d.effect,"DENY");});
test("F4-017 provider unavailable is indeterminate",async()=>{const r=new PolicyRegistry();const b=ready(r);const a:PolicyDecisionAdapter={evaluate:async()=>({outcome:"PROVIDER_UNAVAILABLE",provider:"opa",providerVersion:"1",reason:"down",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest})};const d=await new PolicyGovernance(r,a,limits()).evaluate(request(),b.policyId);assert.equal(d.effect,"INDETERMINATE");assert.equal(d.evidence.failureCode,"POLICY_PROVIDER_UNAVAILABLE");});
test("F4-018 malformed provider fails closed",async()=>{const r=new PolicyRegistry();const b=ready(r);const a:PolicyDecisionAdapter={evaluate:async()=>({outcome:"ALLOW",provider:"",providerVersion:"1",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest})};await asyncCode(()=>new PolicyGovernance(r,a,limits()).evaluate(request(),b.policyId),"POLICY_INVALID");});
test("F4-019 provider incompatibility is typed",async()=>{const r=new PolicyRegistry();const b=ready(r);const a:PolicyDecisionAdapter={evaluate:async()=>({outcome:"PROVIDER_INCOMPATIBLE",provider:"x",providerVersion:"0",reason:"unsupported",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest})};const d=await new PolicyGovernance(r,a,limits()).evaluate(request(),b.policyId);assert.equal(d.evidence.failureCode,"POLICY_PROVIDER_INCOMPATIBLE");});
test("F4-020 evidence binds policy and request",async()=>{const r=new PolicyRegistry();const b=ready(r);const ledger=new InMemoryPolicyDecisionLedger();const g=new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits(),ledger);const d=await g.evaluate(request(),b.policyId);assert.equal(d.evidence.policyDigest,b.digest);assert.equal(d.evidence.requestDigest,normalizePolicyRequest(request()).requestDigest);assert.deepEqual(ledger.all()[0],d);});
test("F4-021 context changes digest",async()=>{const r=new PolicyRegistry();const b=ready(r);const g=new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits());const a=await g.evaluate(request({context:{region:"eg"}}),b.policyId);const c=await g.evaluate(request({context:{region:"us"}}),b.policyId);assert.notEqual(a.evidence.requestDigest,c.evidence.requestDigest);});
test("F4-022 federated request needs local allow",async()=>{const r=new PolicyRegistry();const b=ready(r,bundle({rules:[{id:"other",effect:"ALLOW",capabilityId:"other",reason:"other"}]}));const d=await new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits()).evaluateFederated(request(),b.policyId,{originDomain:"remote",requestedCapability:"evidence.read"});assert.equal(d.effect,"DENY");});
test("F4-023 remote assertion cannot widen local policy",async()=>{const r=new PolicyRegistry();const b=ready(r,bundle({rules:[{id:"n",effect:"ALLOW",capabilityId:"evidence.read",scopePrefix:"evidence/narrow",reason:"n"}]}));const d=await new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits()).evaluateFederated(request({scope:"evidence/broad"}),b.policyId,{originDomain:"trusted",remotePolicyAssertion:"ALLOW"});assert.equal(d.effect,"DENY");});

// Limits/security/determinism/concurrency

test("F4-024 policy size bound",async()=>{const r=new PolicyRegistry();const b=ready(r,bundle({rules:[{id:"a",effect:"ALLOW",reason:"x".repeat(5000)}]}));let calls=0;const a:PolicyDecisionAdapter={evaluate:async()=>{calls++;return{outcome:"ALLOW",provider:"x",providerVersion:"1",decisionId:"1",ruleId:"a",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest};}};await asyncCode(()=>new PolicyGovernance(r,a,limits({maxPolicyBytes:100})).evaluate(request(),b.policyId),"POLICY_RESOURCE_EXHAUSTED");assert.equal(calls,0);});
test("F4-025 rule count bound",async()=>{const r=new PolicyRegistry();const b=ready(r,bundle({rules:Array.from({length:4},(_,i)=>({id:`r${i}`,effect:"ALLOW" as const,reason:"r"}))}));await asyncCode(()=>new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits({maxRules:2})).evaluate(request(),b.policyId),"POLICY_RESOURCE_EXHAUSTED");});
test("F4-026 context entry bound",async()=>{const r=new PolicyRegistry();const b=ready(r);await asyncCode(()=>new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits({maxContextEntries:1})).evaluate(request({context:{a:1,b:2}}),b.policyId),"POLICY_RESOURCE_EXHAUSTED");});
test("F4-027 concurrent evaluations cannot bypass limit",async()=>{const r=new PolicyRegistry();const b=ready(r);let release!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve;});let calls=0;const a:PolicyDecisionAdapter={evaluate:async()=>{calls++;await hold;return{outcome:"ALLOW",provider:"x",providerVersion:"1",decisionId:"1",ruleId:"a",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest};}};const g=new PolicyGovernance(r,a,limits({maxConcurrentEvaluations:1}));const first=g.evaluate(request(),b.policyId);await new Promise(resolve=>setTimeout(resolve,0));await asyncCode(()=>g.evaluate(request({subjectId:"s2"}),b.policyId),"POLICY_RESOURCE_EXHAUSTED");release();await first;assert.equal(calls,1);});
test("F4-028 deterministic replay",async()=>{const r=new PolicyRegistry();const b=ready(r);const g=new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits());assert.deepEqual(await g.evaluate(request(),b.policyId),await g.evaluate(request(),b.policyId));});
test("F4-029 policy digest tamper",()=>{const r=new PolicyRegistry();syncCode(()=>r.register({...bundle(),digest:"0".repeat(64)}),"POLICY_INTEGRITY_FAILURE");});
test("F4-030 provenance tamper",()=>{const r=new PolicyRegistry();const b=bundle();r.register(b);syncCode(()=>r.register({...b,provenanceId:"attacker"}),"POLICY_INTEGRITY_FAILURE");});
test("F4-031 provider cannot widen local scope",async()=>{const r=new PolicyRegistry();const b=ready(r,bundle({rules:[{id:"n",effect:"ALLOW",capabilityId:"evidence.read",scopePrefix:"evidence/narrow",reason:"n"}]}));let calls=0;const a:PolicyDecisionAdapter={evaluate:async()=>{calls++;return{outcome:"ALLOW",provider:"remote",providerVersion:"1",decisionId:"1",ruleId:"remote",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest};}};const d=await new PolicyGovernance(r,a,limits()).evaluate(request({scope:"evidence/broad"}),b.policyId);assert.equal(d.effect,"DENY");assert.equal(calls,0);});
test("F4-032 missing policy",async()=>{await asyncCode(()=>new PolicyGovernance(new PolicyRegistry(),new LocalDeterministicPolicyAdapter(),limits()).evaluate(request(),"missing"),"POLICY_NOT_FOUND");});
test("F4-033 ambiguous activation",()=>{const r=new PolicyRegistry();r.register(bundle({version:"1"}));r.register(bundle({version:"2"}));r.activate("access","1",T1);syncCode(()=>r.activate("access","2",T1),"POLICY_AMBIGUOUS");});
test("F4-034 provider incompatibility attribution",async()=>{const r=new PolicyRegistry();const b=ready(r);const a:PolicyDecisionAdapter={evaluate:async()=>({outcome:"PROVIDER_INCOMPATIBLE",provider:"x",providerVersion:"0",reason:"unsupported",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest})};const d=await new PolicyGovernance(r,a,limits()).evaluate(request(),b.policyId);assert.equal(d.evidence.failureCode,"POLICY_PROVIDER_INCOMPATIBLE");});
test("F4-035 invalid provider result indeterminate",async()=>{const r=new PolicyRegistry();const b=ready(r);const a:PolicyDecisionAdapter={evaluate:async()=>({outcome:"INVALID_RESULT",provider:"x",providerVersion:"1",reason:"bad",policyId:b.policyId,policyVersion:b.version,policyDigest:b.digest})};const d=await new PolicyGovernance(r,a,limits()).evaluate(request(),b.policyId);assert.equal(d.effect,"INDETERMINATE");});
test("F4-036 duplicate registration cannot replace original",()=>{const r=new PolicyRegistry();const b=bundle();r.register(b);syncCode(()=>r.register(bundle({rules:[{id:"different",effect:"ALLOW",reason:"different"}]})),"POLICY_INTEGRITY_FAILURE");assert.equal(r.get("access","1").digest,b.digest);});
test("F4-037 repeated activation is idempotent",()=>{const r=new PolicyRegistry();r.register(bundle());r.activate("access","1",T1);r.activate("access","1",T1);assert.equal(r.lifecycleLog().filter(entry=>entry.action==="ACTIVATE").length,1);});
test("F4-038 historical decision remains bound after retirement",async()=>{const r=new PolicyRegistry();const b=ready(r);const g=new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits());const a=await g.evaluate(request(),b.policyId);r.retire(b.policyId,b.version,T2);const d=await g.evaluate(request({at:T1}),b.policyId,b.version);assert.deepEqual(a,d);});
test("F4-039 ledger evidence is immutable to callers",async()=>{const r=new PolicyRegistry();const b=ready(r);const ledger=new InMemoryPolicyDecisionLedger();const g=new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits(),ledger);const d=await g.evaluate(request(),b.policyId);const copy=ledger.all()[0]!;copy.evidence.reason="changed";assert.equal(ledger.all()[0]!.evidence.reason,d.evidence.reason);});
test("F4-040 federated outcome follows local policy",async()=>{const r=new PolicyRegistry();const b=ready(r);const g=new PolicyGovernance(r,new LocalDeterministicPolicyAdapter(),limits());const denied=await g.evaluateFederated(request({scope:"evidence/secret/x"}),b.policyId,{originDomain:"remote",requestedCapability:"evidence.read",remotePolicyAssertion:"ALLOW"});assert.equal(denied.effect,"DENY");const allowed=await g.evaluateFederated(request(),b.policyId,{originDomain:"remote",requestedCapability:"evidence.read",remotePolicyAssertion:"DENY"});assert.equal(allowed.effect,"ALLOW");});
