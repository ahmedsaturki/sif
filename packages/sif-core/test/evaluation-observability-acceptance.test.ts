import test from "node:test";
import assert from "node:assert/strict";
import { BoundedFaultInjector, EvaluationObservabilityError, InMemoryObservationSink, NoopObservationSink, RegressionSuiteRunner, assertPromotionEvidence, createEvaluationRecord, createObservation, emitObservationSafely, makeReplayDescriptor, normalizeTraceContext, verifyReplayDescriptor, type EvaluationObservabilityLimits, type EvaluationRecord, type TraceContext } from "../src/index.js";

const L: EvaluationObservabilityLimits = { maxTraceBaggageEntries: 4, maxTraceBaggageBytes: 1000, maxObservationBytes: 4000, maxObservationAttributes: 4, maxEvaluationInputBytes: 1000, maxEvaluationRecordBytes: 5000, maxEvaluationRecords: 10, maxConcurrentEvaluations: 2, maxFaultActions: 4 };
const T: TraceContext = { traceId: "t", spanId: "s", correlationId: "c", baggage: { a: "b" } };
const C = "candidate"; const E = "env";
function err(e: unknown): string | undefined { return e instanceof EvaluationObservabilityError ? e.code : undefined; }
function ex(action: () => unknown, want: string): void { let got: unknown; try { action(); } catch (e: unknown) { got = e; } assert.equal(err(got), want); }
async function axe(action: () => Promise<unknown>, want: string): Promise<void> { let got: unknown; try { await action(); } catch (e: unknown) { got = e; } assert.equal(err(got), want); }
function r(over: Partial<EvaluationRecord> = {}): EvaluationRecord {
  const args = {
    evaluationCase: { suiteId: "s", caseId: over.caseId ?? "c", candidateCommit: over.candidateCommit ?? C, environmentFingerprint: over.environmentFingerprint ?? E, input: { x: 1 }, expected: true },
    measured: true,
    status: over.status ?? "PASS",
    trace: normalizeTraceContext(T, L),
    ...(over.evidenceRefs === undefined ? {} : { evidenceRefs: over.evidenceRefs }),
    ...(over.failure === undefined ? {} : { failure: over.failure }),
  } as const;
  return createEvaluationRecord(args, L);
}
function tr(): ReturnType<typeof normalizeTraceContext> { return normalizeTraceContext(T, L); }

test("F5-001",()=>{const x=tr();assert.equal(x.traceId,"t");assert.equal(x.contextDigest.length,64);});
test("F5-002",()=>assert.deepEqual(tr(),tr()));
test("F5-003",()=>assert.equal(normalizeTraceContext({...T,parentSpanId:"p"},L).parentSpanId,"p"));
test("F5-004",()=>ex(()=>normalizeTraceContext({...T,traceId:""},L),"INVALID_TRACE"));
test("F5-005",()=>ex(()=>normalizeTraceContext({...T,spanId:""},L),"INVALID_TRACE"));
test("F5-006",()=>ex(()=>normalizeTraceContext({...T,correlationId:""},L),"INVALID_TRACE"));
test("F5-007",()=>{const b:Record<string,string>={};for(let i=0;i<5;i++)b[`k${i}`]="v";ex(()=>normalizeTraceContext({...T,baggage:b},L),"RESOURCE_EXHAUSTED");});
test("F5-008",()=>ex(()=>normalizeTraceContext({...T,baggage:{x:"x".repeat(2000)}},L),"RESOURCE_EXHAUSTED"));
test("F5-009",()=>assert.equal(tr().baggage!.a,"b"));
test("F5-010",()=>{const b={a:"b"};const x=normalizeTraceContext({traceId:"t",spanId:"s",correlationId:"c",baggage:b},L);b.a="x";assert.equal(x.baggage!.a,"b");});

test("F5-011",()=>{const t=tr();const a=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00Z",trace:t},L);const b=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00Z",trace:t},L);assert.equal(a.observationId,b.observationId);});
test("F5-012",()=>{const o=createObservation({kind:"LOG",name:"x",occurredAt:"2026-09-17T00:00:00Z",trace:tr(),attributes:{a:true}},L);assert.equal(o.attributes.a,true);});
test("F5-013",()=>ex(()=>createObservation({kind:"LOG",name:"",occurredAt:"2026-09-17T00:00:00Z",trace:tr()},L),"INVALID_TRACE"));
test("F5-014",()=>ex(()=>createObservation({kind:"LOG",name:"x",occurredAt:"bad",trace:tr()},L),"INVALID_TRACE"));
test("F5-015",()=>{const a:Record<string,boolean>={a:true,b:true,c:true,d:true,e:true};ex(()=>createObservation({kind:"LOG",name:"x",occurredAt:"2026-09-17T00:00:00Z",trace:tr(),attributes:a as never},L),"RESOURCE_EXHAUSTED");});
test("F5-016",()=>ex(()=>createObservation({kind:"LOG",name:"x",occurredAt:"2026-09-17T00:00:00Z",trace:tr(),attributes:{big:"x".repeat(5000)} as never},L),"RESOURCE_EXHAUSTED"));
test("F5-017",()=>{const refs=["e"];const o=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00Z",trace:tr(),evidenceRefs:refs},L);refs.push("z");assert.deepEqual(o.evidenceRefs,["e"]);});
test("F5-018",async()=>{const s=new InMemoryObservationSink();const o=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00Z",trace:tr()},L);await s.emit(o);const c=s.all()[0]!;c.name="z";assert.equal(s.all()[0]!.name,"x");});
test("F5-019",async()=>{const s=new InMemoryObservationSink(1);const o=createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00Z",trace:tr()},L);await s.emit(o);let failed=false;try{await s.emit(o);}catch(e:unknown){failed=e instanceof Error;}assert.equal(failed,true);});
test("F5-020",async()=>{await emitObservationSafely({emit:async()=>{throw new Error("down");}},createObservation({kind:"TRACE",name:"x",occurredAt:"2026-09-17T00:00:00Z",trace:tr()},L));});

test("F5-021",()=>assert.equal(r().evaluationId,r().evaluationId));
test("F5-022",()=>assert.equal(r().candidateCommit,C));
test("F5-023",()=>assert.equal(r().environmentFingerprint,E));
test("F5-024",()=>assert.equal(r().inputDigest.length,64));
test("F5-025",()=>{const z=r();assert.equal(z.expectedDigest.length,64);assert.equal(z.measuredDigest.length,64);});
test("F5-026",()=>assert.equal(r().status,"PASS"));
test("F5-027",()=>assert.equal(r({status:"FAIL",failure:"boom"}).failure,"boom"));
test("F5-028",()=>assert.deepEqual(r({evidenceRefs:["a","b"]}).evidenceRefs,["a","b"]));
test("F5-029",async()=>{const trace=tr();await axe(()=>Promise.resolve().then(()=>createEvaluationRecord({evaluationCase:{suiteId:"s",caseId:"c",candidateCommit:C,environmentFingerprint:E,input:"x".repeat(2000),expected:true},measured:true,status:"PASS",trace},L)),"RESOURCE_EXHAUSTED");});
test("F5-030",()=>{const input={x:1};const z=createEvaluationRecord({evaluationCase:{suiteId:"s",caseId:"c",candidateCommit:C,environmentFingerprint:E,input,expected:true},measured:true,status:"PASS",trace:tr()},L);input.x=2;assert.equal(z.inputDigest.length,64);});

test("F5-031",()=>assert.equal(makeReplayDescriptor(r(),"a").candidateCommit,C));
test("F5-032",()=>assert.equal(makeReplayDescriptor(r(),"a").artifactDigest,"a"));
test("F5-033",()=>{const z=r();verifyReplayDescriptor(makeReplayDescriptor(z,"a"),{suiteId:"s",caseId:"c",candidateCommit:C,environmentFingerprint:E,input:{x:1},expected:true},"a");});
test("F5-034",()=>{const z=r();ex(()=>verifyReplayDescriptor(makeReplayDescriptor(z,"a"),{suiteId:"s",caseId:"c",candidateCommit:"x",environmentFingerprint:E,input:{x:1},expected:true},"a"),"CANDIDATE_MISMATCH");});
test("F5-035",()=>{const z=r();ex(()=>verifyReplayDescriptor(makeReplayDescriptor(z,"a"),{suiteId:"s",caseId:"c",candidateCommit:C,environmentFingerprint:E,input:{x:1},expected:true},"b"),"CANDIDATE_MISMATCH");});
test("F5-036",()=>{const z=r();ex(()=>verifyReplayDescriptor(makeReplayDescriptor(z,"a"),{suiteId:"s",caseId:"c",candidateCommit:C,environmentFingerprint:E,input:{x:2},expected:true},"a"),"EVALUATION_NOT_REPLAYABLE");});
test("F5-037",()=>{const z=r();ex(()=>verifyReplayDescriptor(makeReplayDescriptor(z,"a"),{suiteId:"s",caseId:"c",candidateCommit:C,environmentFingerprint:E,input:{x:1},expected:false},"a"),"EVALUATION_NOT_REPLAYABLE");});
test("F5-038",()=>assert.deepEqual(makeReplayDescriptor(r(),"a"),makeReplayDescriptor(r(),"a")));
test("F5-039",()=>ex(()=>makeReplayDescriptor(r(),""),"INVALID_TRACE"));
test("F5-040",()=>assert.equal(makeReplayDescriptor(r(),"a").environmentFingerprint,E));

test("F5-041",async()=>{const s=new InMemoryObservationSink();let active=0,max=0;const cs=Array.from({length:4},(_,i)=>({id:`c${i}`,run:async()=>{active++;max=Math.max(max,active);await new Promise<void>((resolve)=>setTimeout(resolve,5));active--;}}));const z=await new RegressionSuiteRunner(s,L).run("s",C,cs,tr(),E);assert.equal(z.passed,4);assert.equal(max,2);});
test("F5-042",async()=>{const s=new InMemoryObservationSink();const z=await new RegressionSuiteRunner(s,L).run("s",C,[{id:"a",run:async()=>{throw new Error("boom");}}],tr(),E);assert.equal(z.failed,1);});
test("F5-043",async()=>{const s=new InMemoryObservationSink();await new RegressionSuiteRunner(s,L).run("s",C,[{id:"a",run:async()=>{}}],tr(),E);assert.equal(s.all().length,1);});
test("F5-044",async()=>{const s=new InMemoryObservationSink();const z=await new RegressionSuiteRunner(s,L).run("s",C,[{id:"a",run:async()=>{}}],tr(),E);assert.equal(z.candidateCommit,C);assert.equal(z.results[0]!.environmentFingerprint,E);});
test("F5-045",async()=>{const s=new InMemoryObservationSink();const cs=Array.from({length:11},(_,i)=>({id:`c${i}`,run:async()=>{}}));await axe(()=>new RegressionSuiteRunner(s,L).run("s",C,cs,tr(),E),"RESOURCE_EXHAUSTED");});
test("F5-046",async()=>{const injector=new BoundedFaultInjector({execute:async(request)=>({observed:true,evidenceRef:`evidence:${request.faultId}`})},L);const observed=await injector.inject({faultId:"f1",boundary:"transport",action:"disconnect"});assert.equal(observed.status,"OBSERVED");assert.equal(observed.observed,true);assert.equal(observed.evidenceRef,"evidence:f1");const malformed=new BoundedFaultInjector({execute:async()=>({observed:true})},L);const rejected=await malformed.inject({faultId:"f1-malformed",boundary:"transport",action:"disconnect"});assert.equal(rejected.status,"EVALUATION_FAILED");assert.equal(rejected.observed,false);});
test("F5-047",async()=>{const injector=new BoundedFaultInjector({execute:async()=>({observed:false,reason:"fault did not trigger"})},L);const observed=await injector.inject({faultId:"f2",boundary:"transport",action:"disconnect"});assert.equal(observed.status,"NOT_OBSERVED");assert.equal(observed.observed,false);});
test("F5-048",async()=>{const injector=new BoundedFaultInjector({execute:async()=>{throw new Error("evaluator down");}},L);const observed=await injector.inject({faultId:"f3",boundary:"evaluator",action:"crash"});assert.equal(observed.status,"EVALUATION_FAILED");assert.equal(observed.observed,false);});
test("F5-049",async()=>{const injector=new BoundedFaultInjector({execute:async()=>({observed:false,status:"UNAVAILABLE",reason:"backend unavailable"})},L);const observed=await injector.inject({faultId:"f4",boundary:"backend",action:"disable"});assert.equal(observed.status,"UNAVAILABLE");assert.equal(observed.reason,"backend unavailable");});
test("F5-050",async()=>{const injector=new BoundedFaultInjector({execute:async(request)=>({observed:true,evidenceRef:`ok:${request.faultId}`})},L);for(let i=0;i<L.maxFaultActions;i++)await injector.inject({faultId:`f${i}`,boundary:"x",action:"y"});await axe(()=>injector.inject({faultId:"overflow",boundary:"x",action:"y"}),"RESOURCE_EXHAUSTED");});

test("F5-051",async()=>{const s=new NoopObservationSink();await s.emit(createObservation({kind:"METRIC",name:"x",occurredAt:"2026-09-17T00:00:00Z",trace:tr()},L));});
test("F5-052",()=>ex(()=>assertPromotionEvidence({candidateCommit:"",artifactDigest:"a",evaluations:[r()],faults:[]}),"INVALID_TRACE"));
test("F5-053",()=>ex(()=>assertPromotionEvidence({candidateCommit:C,artifactDigest:"",evaluations:[r()],faults:[]}),"INVALID_TRACE"));
test("F5-054",()=>ex(()=>assertPromotionEvidence({candidateCommit:C,artifactDigest:"a",evaluations:[r({status:"INDETERMINATE"})],faults:[]}),"EVIDENCE_INCOMPLETE"));
test("F5-055",()=>ex(()=>assertPromotionEvidence({candidateCommit:C,artifactDigest:"a",evaluations:[r({status:"UNAVAILABLE"})],faults:[]}),"EVIDENCE_INCOMPLETE"));
test("F5-056",()=>assertPromotionEvidence({candidateCommit:C,artifactDigest:"a",evaluations:[r()],faults:[{faultId:"f",requested:false,observed:false,status:"NOT_OBSERVED"}]}));
test("F5-057",()=>assertPromotionEvidence({candidateCommit:C,artifactDigest:"a",evaluations:[r(),r({caseId:"c2"})],faults:[]}));
test("F5-058",()=>{const z=r();const o=createObservation({kind:"TRACE",name:"evaluation",occurredAt:"2026-09-17T00:00:00Z",trace:tr(),evidenceRefs:[z.evaluationId]},L);assert.equal(o.evidenceRefs![0],z.evaluationId);});
test("F5-059",()=>assert.equal(r().trace.contextDigest.length,64));
test("F5-060",async()=>{const s=new InMemoryObservationSink();const z=await new RegressionSuiteRunner(s,L).run("final",C,[{id:"final",run:async()=>{}}],tr(),E);assert.equal(z.results[0]!.candidateCommit,C);assert.equal(z.results[0]!.environmentFingerprint,E);assertPromotionEvidence({candidateCommit:C,artifactDigest:"a",evaluations:z.results,faults:[]});});
