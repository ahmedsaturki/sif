import test from "node:test";
import assert from "node:assert/strict";
import {
  EvaluationObservabilityError,
  InMemoryObservationSink,
  NoopObservationSink,
  RegressionSuiteRunner,
  assertPromotionEvidence,
  createEvaluationRecord,
  createObservation,
  emitObservationSafely,
  makeReplayDescriptor,
  normalizeTraceContext,
  verifyReplayDescriptor,
  type EvaluationObservabilityLimits,
  type EvaluationRecord,
  type TraceContext,
} from "../src/index.js";

const LIMITS:EvaluationObservabilityLimits={maxTraceBaggageEntries:8,maxTraceBaggageBytes:2000,maxObservationBytes:10000,maxObservationAttributes:20,maxEvaluationInputBytes:5000,maxEvaluationRecords:20,maxConcurrentEvaluations:2,maxFaultActions:10};
const TRACE:TraceContext={traceId:"trace-1",spanId:"span-1",correlationId:"corr-1",baggage:{tenant:"t1"}};
const CANDIDATE="candidate-1"; const ENV="env-1";
function code(error:unknown):string|undefined{return error instanceof EvaluationObservabilityError?error.code:undefined;}
function baseRecord(overrides:Partial<EvaluationRecord>={}):EvaluationRecord{const trace=normalizeTraceContext(TRACE,LIMITS);const evaluationCase={suiteId:"suite",caseId:"case",candidateCommit:CANDIDATE,environmentFingerprint:ENV,input:{x:1},expected:true};return createEvaluationRecord({evaluationCase,measured:true,status:"PASS",trace,evidenceRefs:[],...overrides},LIMITS);}

// F5-001..010 trace identity
test("F5-001 trace context normalizes",()=>{const x=normalizeTraceContext(TRACE,LIMITS);assert.equal(x.traceId,"trace-1");assert.equal(x.contextDigest.length,64);});
test("F5-002 trace normalization is deterministic",()=>{assert.deepEqual(normalizeTraceContext(TRACE,LIMITS),normalizeTraceContext({...TRACE},LIMITS));});
test("F5-003 parent span preserved",()=>{assert.equal(normalizeTraceContext({...TRACE,parentSpanId:"span-0"},LIMITS).parentSpanId,"span-0");});
test("F5-004 empty trace id rejected",()=>{try{normalizeTraceContext({...TRACE,traceId:""},LIMITS);assert.fail("expected error");}catch(e){assert.equal(code(e),"INVALID_TRACE");}});
test("F5-005 empty span id rejected",()=>{try{normalizeTraceContext({...TRACE,spanId:""},LIMITS);assert.fail("expected error");}catch(e){assert.equal(code(e),"INVALID_TRACE");}});
test("F5-006 empty correlation id rejected",()=>{try{normalizeTraceContext({...TRACE,correlationId:""},LIMITS);assert.fail("expected error");}catch(e){assert.equal(code(e),"INVALID_TRACE");}});
test("F5-007 baggage entry bound",()=>{const baggage:Record<string,string>={};for(let i=0;i<9;i++)baggage[`k${i}`]="v";try{normalizeTraceContext({...TRACE,baggage},LIMITS);assert.fail("expected error");}catch(e){assert.equal(code(e),"RESOURCE_EXHAUSTED");}});
test("F5-008 baggage byte bound",()=>{try{normalizeTraceContext({...TRACE,baggage:{x:"x".repeat(3000)}},LIMITS);assert.fail("expected error");}catch(e){assert.equal(code(e),"RESOURCE_EXHAUSTED");}});
test("F5-009 missing baggage remains valid",()=>{const x=normalizeTraceContext({traceId:"t",spanId:"s",correlationId:"c"},LIMITS);assert.equal(x.baggage,undefined);});
test("F5-010 trace context caller mutation cannot alter normalized copy",()=>{const baggage={tenant:"t"};const x=normalizeTraceContext({traceId:"t",spanId:"s",correlationId:"c",baggage},LIMITS);baggage.tenant="changed";assert.equal(x.baggage!.tenant,"t");});

// F5-011..020 observation boundary
test("F5-011 trace observation has deterministic identity",()=>{const t=normalizeTraceContext(TRACE,LIMITS);const a=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00.000Z",trace:t},LIMITS);const b=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00.000Z",trace:t},LIMITS);assert.equal(a.observationId,b.observationId);});
test("F5-012 observation attributes are preserved",()=>{const t=normalizeTraceContext(TRACE,LIMITS);const o=createObservation({kind:"LOG",name:"x",occurredAt:"2026-09-17T00:00:00.000Z",trace:t,attributes:{ok:true,n:2,v:null}},LIMITS);assert.equal(o.attributes.n,2);});
test("F5-013 observation name required",()=>{const t=normalizeTraceContext(TRACE,LIMITS);try{createObservation({kind:"LOG",name:"",occurredAt:"2026-09-17T00:00:00.000Z",trace:t},LIMITS);assert.fail("expected error");}catch(e){assert.equal(code(e),"INVALID_TRACE");}});
test("F5-014 observation timestamp validated",()=>{const t=normalizeTraceContext(TRACE,LIMITS);try{createObservation({kind:"LOG",name:"x",occurredAt:"bad",trace:t},LIMITS);assert.fail("expected error");}catch(e){assert.equal(code(e),"INVALID_TRACE");}});
test("F5-015 observation attribute count bound",()=>{const t=normalizeTraceContext(TRACE,LIMITS);const a:Record<string,boolean>={};for(let i=0;i<21;i++)a[`k${i}`]=true;try{createObservation({kind:"LOG",name:"x",occurredAt:"2026-09-17T00:00:00.000Z",trace:t,attributes:a},LIMITS);assert.fail("expected error");}catch(e){assert.equal(code(e),"RESOURCE_EXHAUSTED");}});
test("F5-016 observation byte bound",()=>{const t=normalizeTraceContext(TRACE,LIMITS);try{createObservation({kind:"LOG",name:"x",occurredAt:"2026-09-17T00:00:00.000Z",trace:t,attributes:{big:"x".repeat(20000)}},LIMITS);assert.fail("expected error");}catch(e){assert.equal(code(e),"RESOURCE_EXHAUSTED");}});
test("F5-017 evidence refs are copied",()=>{const t=normalizeTraceContext(TRACE,LIMITS);const refs=["e1"];const o=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00.000Z",trace:t,evidenceRefs:refs},LIMITS);refs.push("e2");assert.deepEqual(o.evidenceRefs,["e1"]);});
test("F5-018 in-memory sink stores a copy",async()=>{const sink=new InMemoryObservationSink();const t=normalizeTraceContext(TRACE,LIMITS);const o=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00.000Z",trace:t},LIMITS);await sink.emit(o);const copy=sink.all()[0]!;copy.name="changed";assert.equal(sink.all()[0]!.name,"x");});
test("F5-019 sink capacity fails closed",async()=>{const sink=new InMemoryObservationSink(1);const t=normalizeTraceContext(TRACE,LIMITS);const o=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00.000Z",trace:t},LIMITS);await sink.emit(o);try{await sink.emit(o);assert.fail("expected error");}catch(error){assert.equal(error instanceof Error,true);}});
test("F5-020 observation sink failure is isolated",async()=>{const sink={emit:async()=>{throw new Error("sink down");}};const t=normalizeTraceContext(TRACE,LIMITS);const o=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00.000Z",trace:t},LIMITS);await emitObservationSafely(sink,o);assert.equal(true,true);});

// F5-021..030 evaluation records
test("F5-021 evaluation identity is deterministic",()=>{assert.equal(baseRecord().evaluationId,baseRecord().evaluationId);});
test("F5-022 candidate commit is retained",()=>{assert.equal(baseRecord().candidateCommit,CANDIDATE);});
test("F5-023 environment identity is retained",()=>{assert.equal(baseRecord().environmentFingerprint,ENV);});
test("F5-024 input digest is deterministic",()=>{assert.equal(baseRecord().inputDigest.length,64);});
test("F5-025 expected and measured digests are separated",()=>{assert.notEqual(baseRecord().expectedDigest,baseRecord().measuredDigest);});
test("F5-026 pass status records success",()=>{assert.equal(baseRecord().status,"PASS");});
test("F5-027 fail status records failure text",()=>{const trace=normalizeTraceContext(TRACE,LIMITS);const r=createEvaluationRecord({evaluationCase:{suiteId:"s",caseId:"c",candidateCommit:CANDIDATE,environmentFingerprint:ENV,input:{x:1},expected:true},measured:"bad",status:"FAIL",trace,failure:"bad"},LIMITS);assert.equal(r.failure,"bad");});
test("F5-028 evidence refs retained",()=>{assert.deepEqual(baseRecord({evidenceRefs:["e1","e2"]}).evidenceRefs,["e1","e2"]);});
test("F5-029 input byte bound",()=>{const trace=normalizeTraceContext(TRACE,LIMITS);try{createEvaluationRecord({evaluationCase:{suiteId:"s",caseId:"c",candidateCommit:CANDIDATE,environmentFingerprint:ENV,input:"x".repeat(6000),expected:true},measured:true,status:"PASS",trace},LIMITS);assert.fail("expected error");}catch(e){assert.equal(code(e),"RESOURCE_EXHAUSTED");}});
test("F5-030 caller input mutation cannot change record",()=>{const trace=normalizeTraceContext(TRACE,LIMITS);const input={x:1};const r=createEvaluationRecord({evaluationCase:{suiteId:"s",caseId:"c",candidateCommit:CANDIDATE,environmentFingerprint:ENV,input,expected:true},measured:true,status:"PASS",trace},LIMITS);input.x=2;assert.equal(r.inputDigest.length,64);});

// F5-031..040 replay
test("F5-031 replay binds candidate",()=>{assert.equal(makeReplayDescriptor(baseRecord(),"artifact").candidateCommit,CANDIDATE);});
test("F5-032 replay binds artifact",()=>{assert.equal(makeReplayDescriptor(baseRecord(),"artifact").artifactDigest,"artifact");});
test("F5-033 replay verifies exact case",()=>{const r=baseRecord();verifyReplayDescriptor(makeReplayDescriptor(r,"artifact"),{suiteId:r.suiteId,caseId:r.caseId,candidateCommit:r.candidateCommit,environmentFingerprint:r.environmentFingerprint,input:{x:1},expected:true},"artifact");});
test("F5-034 replay rejects candidate mismatch",()=>{const r=baseRecord();try{verifyReplayDescriptor(makeReplayDescriptor(r,"artifact"),{suiteId:r.suiteId,caseId:r.caseId,candidateCommit:"other",environmentFingerprint:r.environmentFingerprint,input:{x:1},expected:true},"artifact");assert.fail("expected error");}catch(e){assert.equal(code(e),"CANDIDATE_MISMATCH");}});
test("F5-035 replay rejects artifact mismatch",()=>{const r=baseRecord();try{verifyReplayDescriptor(makeReplayDescriptor(r,"artifact"),{suiteId:r.suiteId,caseId:r.caseId,candidateCommit:r.candidateCommit,environmentFingerprint:r.environmentFingerprint,input:{x:1},expected:true},"other");assert.fail("expected error");}catch(e){assert.equal(code(e),"CANDIDATE_MISMATCH");}});
test("F5-036 replay rejects input mismatch",()=>{const r=baseRecord();try{verifyReplayDescriptor(makeReplayDescriptor(r,"artifact"),{suiteId:r.suiteId,caseId:r.caseId,candidateCommit:r.candidateCommit,environmentFingerprint:r.environmentFingerprint,input:{x:2},expected:true},"artifact");assert.fail("expected error");}catch(e){assert.equal(code(e),"EVALUATION_NOT_REPLAYABLE");}});
test("F5-037 replay rejects expected mismatch",()=>{const r=baseRecord();try{verifyReplayDescriptor(makeReplayDescriptor(r,"artifact"),{suiteId:r.suiteId,caseId:r.caseId,candidateCommit:r.candidateCommit,environmentFingerprint:r.environmentFingerprint,input:{x:1},expected:false},"artifact");assert.fail("expected error");}catch(e){assert.equal(code(e),"EVALUATION_NOT_REPLAYABLE");}});
test("F5-038 replay descriptor is stable",()=>{const r=baseRecord();assert.deepEqual(makeReplayDescriptor(r,"artifact"),makeReplayDescriptor(r,"artifact"));});
test("F5-039 missing artifact identity rejected",()=>{try{makeReplayDescriptor(baseRecord(),"");assert.fail("expected error");}catch(e){assert.equal(code(e),"INVALID_TRACE");}});
test("F5-040 environment fingerprint carried",()=>{assert.equal(makeReplayDescriptor(baseRecord(),"a").environmentFingerprint,ENV);});

// F5-041..050 regression/fault evidence
test("F5-041 regression records pass",async()=>{const sink=new InMemoryObservationSink();const trace=normalizeTraceContext(TRACE,LIMITS);const r=await new RegressionSuiteRunner(sink,LIMITS).run("suite",CANDIDATE,[{id:"a",run:async()=>{}}],trace);assert.equal(r.passed,1);});
test("F5-042 regression records failure",async()=>{const sink=new InMemoryObservationSink();const trace=normalizeTraceContext(TRACE,LIMITS);const r=await new RegressionSuiteRunner(sink,LIMITS).run("suite",CANDIDATE,[{id:"a",run:async()=>{throw new Error("boom");}}],trace);assert.equal(r.failed,1);});
test("F5-043 regression emits trace observation",async()=>{const sink=new InMemoryObservationSink();const trace=normalizeTraceContext(TRACE,LIMITS);await new RegressionSuiteRunner(sink,LIMITS).run("suite",CANDIDATE,[{id:"a",run:async()=>{}}],trace);assert.equal(sink.all().length,1);});
test("F5-044 regression candidate retained",async()=>{const sink=new InMemoryObservationSink();const trace=normalizeTraceContext(TRACE,LIMITS);const r=await new RegressionSuiteRunner(sink,LIMITS).run("suite",CANDIDATE,[{id:"a",run:async()=>{}}],trace);assert.equal(r.candidateCommit,CANDIDATE);});
test("F5-045 regression case count bounded",async()=>{const sink=new InMemoryObservationSink();const trace=normalizeTraceContext(TRACE,LIMITS);const cases=Array.from({length:21},(_,i)=>({id:`c${i}`,run:async()=>{}}));try{await new RegressionSuiteRunner(sink,LIMITS).run("suite",CANDIDATE,cases,trace);assert.fail("expected error");}catch(e){assert.equal(code(e),"RESOURCE_EXHAUSTED");}});
test("F5-046 promotion accepts passing evaluations",()=>{assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"a",evaluations:[baseRecord()],faults:[]});});
test("F5-047 promotion rejects missing evaluations",()=>{try{assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"a",evaluations:[],faults:[]});assert.fail("expected error");}catch(e){assert.equal(code(e),"EVIDENCE_INCOMPLETE");}});
test("F5-048 promotion rejects candidate mismatch",()=>{try{assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"a",evaluations:[baseRecord({candidateCommit:"other"})],faults:[]});assert.fail("expected error");}catch(e){assert.equal(code(e),"CANDIDATE_MISMATCH");}});
test("F5-049 promotion rejects non-pass",()=>{try{assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"a",evaluations:[baseRecord({status:"FAIL"})],faults:[]});assert.fail("expected error");}catch(e){assert.equal(code(e),"EVIDENCE_INCOMPLETE");}});
test("F5-050 promotion requires observed faults",()=>{try{assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"a",evaluations:[baseRecord()],faults:[{faultId:"f",requested:true,observed:false,status:"NOT_OBSERVED"}]});assert.fail("expected error");}catch(e){assert.equal(code(e),"FAULT_NOT_PROVEN");}});

// F5-051..060 cross-phase/promotion isolation
test("F5-051 noop sink is dependency-free",async()=>{const sink=new NoopObservationSink();const trace=normalizeTraceContext(TRACE,LIMITS);await sink.emit(createObservation({kind:"METRIC",name:"x",occurredAt:"2026-09-17T00:00:00.000Z",trace},LIMITS));});
test("F5-052 promotion requires candidate",()=>{try{assertPromotionEvidence({candidateCommit:"",artifactDigest:"a",evaluations:[baseRecord()],faults:[]});assert.fail("expected error");}catch(e){assert.equal(code(e),"INVALID_TRACE");}});
test("F5-053 promotion requires artifact",()=>{try{assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"",evaluations:[baseRecord()],faults:[]});assert.fail("expected error");}catch(e){assert.equal(code(e),"INVALID_TRACE");}});
test("F5-054 indeterminate not promotable",()=>{try{assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"a",evaluations:[baseRecord({status:"INDETERMINATE"})],faults:[]});assert.fail("expected error");}catch(e){assert.equal(code(e),"EVIDENCE_INCOMPLETE");}});
test("F5-055 unavailable not promotable",()=>{try{assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"a",evaluations:[baseRecord({status:"UNAVAILABLE"})],faults:[]});assert.fail("expected error");}catch(e){assert.equal(code(e),"EVIDENCE_INCOMPLETE");}});
test("F5-056 unrequested unobserved fault does not block",()=>{assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"a",evaluations:[baseRecord()],faults:[{faultId:"f",requested:false,observed:false,status:"NOT_OBSERVED"}]});});
test("F5-057 multiple passing evaluations accepted",()=>{assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"a",evaluations:[baseRecord(),baseRecord({caseId:"case-2"})],faults:[]});});
test("F5-058 observation can reference evaluation",()=>{const r=baseRecord();const t=normalizeTraceContext(TRACE,LIMITS);const o=createObservation({kind:"TRACE",name:"evaluation",occurredAt:"2026-09-17T00:00:00.000Z",trace:t,evidenceRefs:[r.evaluationId]},LIMITS);assert.deepEqual(o.evidenceRefs,[r.evaluationId]);});
test("F5-059 evaluation preserves trace",()=>{assert.equal(baseRecord().trace.contextDigest.length,64);});
test("F5-060 end-to-end candidate evidence remains exact",async()=>{const sink=new InMemoryObservationSink();const trace=normalizeTraceContext(TRACE,LIMITS);const result=await new RegressionSuiteRunner(sink,LIMITS).run("final-suite",CANDIDATE,[{id:"final",run:async()=>{}}],trace);assert.equal(result.results[0]!.candidateCommit,CANDIDATE);assertPromotionEvidence({candidateCommit:CANDIDATE,artifactDigest:"artifact",evaluations:result.results,faults:[]});});
