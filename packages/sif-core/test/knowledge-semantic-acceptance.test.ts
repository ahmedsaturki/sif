import test from "node:test";
import assert from "node:assert/strict";
import { EpistemicKnowledgeStore, KnowledgeSemanticError, LegacyKnowledgeHandoff, ProvenanceGraph, SemanticCompatibilityEngine, SemanticReplayLog, VersionedOntologyRegistry, normalizeKnowledgeSemanticLimits, type EvidenceRef, type EpistemicKnowledgeAssertionInput, type OntologyVersionInput } from "../src/index.js";

const L=normalizeKnowledgeSemanticLimits({maxOntologyVersions:4,maxConceptsPerOntology:5,maxMappingsPerOntology:6,maxKnowledgeRecords:8,maxEvidencePerKnowledge:2,maxProvenanceNodes:8,maxTraversalDepth:3,maxReplayOperations:8,maxPayloadBytes:8000,minCompatibilityConfidence:.8});
const T="2026-01-01T00:00:00.000Z", T2="2026-02-01T00:00:00.000Z";
const E:EvidenceRef={evidenceId:"e1",sourceId:"src",digest:"d",capturedAt:T,scope:"local",confidence:.9};
const base=(o:Partial<OntologyVersionInput>={}):OntologyVersionInput=>({ontologyId:"sif",version:"1",namespace:"sif:test",concepts:[{conceptId:"a",label:"A",definition:"A"},{conceptId:"b",label:"B",definition:"B"}],createdAt:T,...o});
const ki=(o:Partial<EpistemicKnowledgeAssertionInput>={}):EpistemicKnowledgeAssertionInput=>({subjectKey:"entity:1",predicate:"state",objectValue:"active",statement:"active",status:"observed",scope:"local",validFrom:T,evidence:[E],provenanceId:"p1",ontologyId:"sif",ontologyVersion:"1",...o});
const ex=(f:()=>unknown,c:string)=>{let e:unknown;try{f()}catch(x){e=x}assert.equal(e instanceof KnowledgeSemanticError?e.code:undefined,c)};
const reg=()=>{const r=new VersionedOntologyRegistry(L);r.register(base());return r};
const cr=()=>{const r=new VersionedOntologyRegistry(L);r.register(base({version:"1.0",concepts:[{conceptId:"a",label:"A",definition:"A"}]}));r.register(base({version:"2.0",concepts:[{conceptId:"b",label:"B",definition:"B"}] }));return r;};
const cases:Array<[string,()=>void]>=[];const add=(id:string,fn:()=>void)=>cases.push([id,fn]);

add("F6-001",()=>assert.equal(reg().get("sif","1")!.ontologyDigest.length,64));
add("F6-002",()=>assert.equal(reg().digest("sif","1"),reg().get("sif","1")!.ontologyDigest));
add("F6-003",()=>{const r=reg(),x=r.get("sif","1")!;x.concepts[0]!.label="x";assert.equal(r.get("sif","1")!.concepts[0]!.label,"A")});
add("F6-004",()=>assert.equal(reg().get("sif","1")!.lifecycle,"DRAFT"));
add("F6-005",()=>assert.equal(reg().transition("sif","1","ACTIVE").lifecycle,"ACTIVE"));
add("F6-006",()=>{const r=reg();r.transition("sif","1","ACTIVE");assert.equal(r.transition("sif","1","RETIRED").lifecycle,"RETIRED")});
add("F6-007",()=>{const r=reg();r.transition("sif","1","ACTIVE");ex(()=>r.transition("sif","1","DRAFT"),"INVALID_LIFECYCLE")});
add("F6-008",()=>assert.equal(reg().register(base()).ontologyDigest,reg().register(base()).ontologyDigest));
add("F6-009",()=>ex(()=>reg().register(base({concepts:[...base().concepts,{conceptId:"a",label:"dup",definition:"dup"}]})),"IMMUTABILITY_VIOLATION"));
add("F6-010",()=>ex(()=>reg().register(base({createdAt:"bad"})),"INVALID_INPUT"));
add("F6-011",()=>ex(()=>reg().register(base({concepts:Array.from({length:6},(_,i)=>({conceptId:String(i),label:String(i),definition:String(i)}))})),"RESOURCE_EXHAUSTED"));
add("F6-012",()=>ex(()=>reg().register(base({mappings:Array.from({length:7},(_,i)=>({mappingId:String(i),fromOntologyId:"sif",fromVersion:"1",fromConceptId:"a",toOntologyId:"sif",toVersion:"2",toConceptId:"b",relation:"equivalent",confidence:1,provenanceId:"p"}))})),"RESOURCE_EXHAUSTED"));
add("F6-013",()=>assert.equal(reg().hasConcept("sif","1","a"),true));
add("F6-014",()=>ex(()=>reg().register(base({mappings:[{mappingId:"m",fromOntologyId:"sif",fromVersion:"1",fromConceptId:"a",toOntologyId:"sif",toVersion:"2",toConceptId:"b",relation:"equivalent",confidence:2,provenanceId:"p"}]})),"INVALID_INPUT"));
add("F6-015",()=>{const r=reg(),d=r.digest("sif","1");r.transition("sif","1","ACTIVE");assert.notEqual(r.digest("sif","1"),d)});

function mapReg(relation:"equivalent"|"broader"|"narrower"|"related"|"approximate"|"conditional",confidence=.95){const r=new VersionedOntologyRegistry(L);r.register(base({version:"1",concepts:[{conceptId:"a",label:"A",definition:"A"}],mappings:[{mappingId:"m",fromOntologyId:"sif",fromVersion:"1",fromConceptId:"a",toOntologyId:"sif",toVersion:"2",toConceptId:"b",relation,confidence,provenanceId:"p"}]}));r.register(base({version:"2",concepts:[{conceptId:"b",label:"B",definition:"B"}] }));return r}
add("F6-016",()=>assert.equal(new SemanticCompatibilityEngine(cr(),L).resolve({sourceOntologyId:"sif",sourceVersion:"1.0",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"1.0",targetConceptId:"a"}).status,"EXACT"));
add("F6-017",()=>assert.equal(new SemanticCompatibilityEngine(mapReg("equivalent"),L).resolve({sourceOntologyId:"sif",sourceVersion:"1",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"2",targetConceptId:"b"}).status,"COMPATIBLE"));
add("F6-018",()=>assert.equal(new SemanticCompatibilityEngine(mapReg("broader"),L).resolve({sourceOntologyId:"sif",sourceVersion:"1",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"2",targetConceptId:"b"}).status,"COMPATIBLE"));
add("F6-019",()=>{const e=new SemanticCompatibilityEngine(cr(),L);ex(()=>e.resolve({sourceOntologyId:"sif",sourceVersion:"1.0",sourceConceptId:"x",targetOntologyId:"sif",targetVersion:"2.0",targetConceptId:"b"}),"INVALID_INPUT")});
add("F6-020",()=>assert.equal(new SemanticCompatibilityEngine(cr(),L).resolve({sourceOntologyId:"sif",sourceVersion:"1.0",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"2.0",targetConceptId:"b"}).status,"INCOMPATIBLE"));
add("F6-021",()=>{const r=new VersionedOntologyRegistry(L);r.register(base({version:"1",concepts:[{conceptId:"a",label:"A",definition:"A"}],mappings:[{mappingId:"m1",fromOntologyId:"sif",fromVersion:"1",fromConceptId:"a",toOntologyId:"sif",toVersion:"2",toConceptId:"b",relation:"equivalent",confidence:.9,provenanceId:"p"},{mappingId:"m2",fromOntologyId:"sif",fromVersion:"1",fromConceptId:"a",toOntologyId:"sif",toVersion:"2",toConceptId:"b",relation:"broader",confidence:.95,provenanceId:"p"}]}));r.register(base({version:"2",concepts:[{conceptId:"b",label:"B",definition:"B"}] }));assert.equal(new SemanticCompatibilityEngine(r,L).resolve({sourceOntologyId:"sif",sourceVersion:"1",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"2",targetConceptId:"b"}).status,"INDETERMINATE")});
add("F6-022",()=>assert.equal(new SemanticCompatibilityEngine(mapReg("equivalent",.7),L).resolve({sourceOntologyId:"sif",sourceVersion:"1",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"2",targetConceptId:"b"}).status,"INDETERMINATE"));
add("F6-023",()=>assert.equal(new SemanticCompatibilityEngine(mapReg("approximate"),L).resolve({sourceOntologyId:"sif",sourceVersion:"1",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"2",targetConceptId:"b"}).status,"INDETERMINATE"));
add("F6-024",()=>assert.equal(new SemanticCompatibilityEngine(mapReg("conditional"),L).resolve({sourceOntologyId:"sif",sourceVersion:"1",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"2",targetConceptId:"b"}).status,"INDETERMINATE"));
add("F6-025",()=>assert.equal(new SemanticCompatibilityEngine(cr(),L).resolve({sourceOntologyId:"sif",sourceVersion:"1.0",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"1.0",targetConceptId:"a"}).decisionDigest.length,64));
add("F6-026",()=>{const e=new SemanticCompatibilityEngine(cr(),L),a=e.resolve({sourceOntologyId:"sif",sourceVersion:"1.0",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"1.0",targetConceptId:"a"}),b=e.resolve({sourceOntologyId:"sif",sourceVersion:"1.0",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"1.0",targetConceptId:"a"});assert.equal(a.decisionDigest,b.decisionDigest)});
add("F6-027",()=>assert.equal(new SemanticCompatibilityEngine(cr(),L).resolve({sourceOntologyId:"sif",sourceVersion:"1.0",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"1.0",targetConceptId:"a"}).status,"EXACT"));
add("F6-028",()=>assert.equal(new SemanticCompatibilityEngine(mapReg("equivalent"),L).resolve({sourceOntologyId:"sif",sourceVersion:"1",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"2",targetConceptId:"b"}).mappingId,"m"));
add("F6-029",()=>assert.equal(new SemanticCompatibilityEngine(cr(),L).resolve({sourceOntologyId:"sif",sourceVersion:"1.0",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"1.0",targetConceptId:"a"}).sourceVersion,"1.0"));
add("F6-030",()=>assert.equal(new SemanticCompatibilityEngine(cr(),L).resolve({sourceOntologyId:"sif",sourceVersion:"1.0",sourceConceptId:"a",targetOntologyId:"sif",targetVersion:"2.0",targetConceptId:"b"}).status,"INCOMPATIBLE"));

const ks=()=>new EpistemicKnowledgeStore(L);
add("F6-031",()=>assert.equal(ks().assert(ki()).knowledgeId.length,64));
add("F6-032",()=>{const s=ks(),a=s.assert(ki()),b=s.assert(ki());assert.deepEqual(a,b)});
add("F6-033",()=>{const s=ks(),a=s.assert(ki()),b=s.get(a.knowledgeId)!;b.statement="tampered";assert.equal(s.get(a.knowledgeId)!.statement,"active")});
add("F6-034",()=>ex(()=>ks().assert(ki({evidence:[]})),"INVALID_INPUT"));
add("F6-035",()=>assert.equal(ks().assert(ki({status:"unknown",evidence:[]})).status,"unknown"));
add("F6-036",()=>ex(()=>ks().assert(ki({validUntil:T})),"INVALID_INPUT"));
add("F6-037",()=>assert.equal(ks().assert(ki({validUntil:T2})).validUntil,T2));
add("F6-038",()=>{const s=ks();s.assert(ki({objectValue:"active"}));s.assert(ki({objectValue:"closed",statement:"closed"}));assert.equal(s.queryAt("entity:1",T).contradictions.length,1)});
add("F6-039",()=>{const s=ks();s.assert(ki());assert.doesNotThrow(()=>s.assertNoContradiction("none",T))});
add("F6-040",()=>{const s=ks(),old=s.assert(ki({validUntil:T2})),n=s.assert(ki({objectValue:"closed",statement:"closed",validFrom:T2,supersedesKnowledgeId:old.knowledgeId}));assert.equal(s.queryAt("entity:1",T).records.some(x=>x.knowledgeId===old.knowledgeId),true);assert.equal(s.queryAt("entity:1",T2).records.some(x=>x.knowledgeId===n.knowledgeId),true)});
add("F6-041",()=>{const s=ks(),old=s.assert(ki()),r=s.assert(ki({objectValue:"x",statement:"retract",retractsKnowledgeId:old.knowledgeId}));assert.equal(s.get(old.knowledgeId)!.knowledgeId,old.knowledgeId);assert.equal(r.retractsKnowledgeId,old.knowledgeId)});
add("F6-042",()=>assert.equal(ks().assert(ki({sourceKind:"REMOTE_EVIDENCE"})).sourceKind,"REMOTE_EVIDENCE"));

const pg=()=>new ProvenanceGraph(L),pn=(id:string,parentIds:string[]=[])=>({provenanceId:id,kind:"ASSERTION" as const,label:id,recordedAt:T,parentIds,sourceIds:[]});
add("F6-043",()=>assert.equal(pg().add(pn("p1")).nodeDigest.length,64));
add("F6-044",()=>{const g=pg();g.add(pn("p1"));assert.equal(g.add(pn("p2",["p1"])).parentIds[0],"p1")});
add("F6-045",()=>ex(()=>pg().add(pn("p2",["missing"])),"PROVENANCE_PARENT_MISSING"));
add("F6-046",()=>{const g=pg();g.add(pn("p1"));ex(()=>g.add({...pn("p1"),label:"changed"}),"IMMUTABILITY_VIOLATION")});
add("F6-047",()=>ex(()=>pg().add(pn("p1",["p1"])),"PROVENANCE_CYCLE"));
add("F6-048",()=>{const g=pg();g.add(pn("1"));g.add(pn("2",["1"]));g.add(pn("3",["2"]));g.add(pn("4",["3"]));assert.equal(g.ancestors("4").length,3)});
add("F6-049",()=>{const g=pg();g.add(pn("1"));ex(()=>g.ancestors("1",4),"RESOURCE_EXHAUSTED")});
add("F6-050",()=>{const g=pg();g.add(pn("1"));assert.equal(g.graphDigest(),g.graphDigest())});

const rp=()=>new SemanticReplayLog(L);
add("F6-051",()=>assert.equal(rp().append({kind:"CONCEPT",ontologyId:"sif",ontologyVersion:"1",payload:{conceptId:"a",label:"A",definition:"A"},occurredAt:T}).operationId.length,64));
add("F6-052",()=>{const r=rp();r.append({kind:"CONCEPT",ontologyId:"sif",ontologyVersion:"1",payload:{conceptId:"a",label:"A",definition:"A"},occurredAt:T});assert.equal(r.replay("sif","1").concepts.length,1)});
add("F6-053",()=>{const r=rp();r.append({kind:"CONCEPT",ontologyId:"sif",ontologyVersion:"1",payload:{conceptId:"a",label:"A",definition:"A"},occurredAt:T});assert.equal(r.replay("sif","1").snapshotDigest.length,64)});
add("F6-054",()=>{const r=rp();r.append({kind:"CONCEPT",ontologyId:"sif",ontologyVersion:"1",payload:{conceptId:"a",label:"A",definition:"A"},occurredAt:T});ex(()=>r.replay("sif","1","wrong"),"REPLAY_MISMATCH")});
add("F6-055",()=>{const r=rp();r.append({kind:"MAPPING",ontologyId:"sif",ontologyVersion:"1",payload:{mappingId:"m"},occurredAt:T});assert.equal(r.replay("other","1").operationCount,0)});
add("F6-056",()=>ex(()=>rp().append({kind:"CONCEPT",ontologyId:"sif",ontologyVersion:"1",payload:"x".repeat(9000),occurredAt:T}),"RESOURCE_EXHAUSTED"));

const legacy=()=>new LegacyKnowledgeHandoff(ks());
add("F6-057",()=>assert.equal(legacy().adopt({legacyId:"old",statement:"legacy",status:"observed",scope:"legacy",capturedAt:T,evidence:[E],provenanceId:"p",ontologyId:"sif",ontologyVersion:"1"}).sourceKind,"LEGACY"));
add("F6-058",()=>assert.equal(legacy().adopt({legacyId:"old2",statement:"legacy",status:"observed",scope:"legacy",capturedAt:T,evidence:[E],provenanceId:"p",ontologyId:"sif",ontologyVersion:"7"}).ontologyVersion,"7"));
add("F6-059",()=>assert.throws(()=>legacy().assertNoAuthorityWidening(),KnowledgeSemanticError));
add("F6-060",()=>{const s=ks(),h=new LegacyKnowledgeHandoff(s),o=h.adopt({legacyId:"old3",statement:"remote",status:"observed",scope:"remote",capturedAt:T,evidence:[E],provenanceId:"p",ontologyId:"sif",ontologyVersion:"1"});assert.equal(s.get(o.knowledgeId)!.sourceKind,"LEGACY");assert.equal(o.authorityWidened,false)});

assert.equal(cases.length,60);
for(const [id,fn] of cases)test(id,fn);
