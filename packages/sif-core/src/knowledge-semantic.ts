import { digest, stableStringify } from "./core.js";
import type { EvidenceRef, EpistemicStatus } from "./types.js";

export type SemanticLifecycle = "DRAFT" | "ACTIVE" | "RETIRED";
export type SemanticCompatibilityStatus = "EXACT" | "COMPATIBLE" | "INCOMPATIBLE" | "INDETERMINATE";
export type SemanticRelation = "equivalent" | "broader" | "narrower" | "related" | "approximate" | "conditional";
export type KnowledgeSourceKind = "LOCAL" | "REMOTE_EVIDENCE" | "LEGACY";
export type ProvenanceNodeKind = "SOURCE" | "ACTIVITY" | "ASSERTION" | "DERIVATION" | "HANDOFF";
export type SemanticOperationKind = "CONCEPT" | "MAPPING" | "KNOWLEDGE";

export interface KnowledgeSemanticLimits { maxOntologyVersions:number; maxConceptsPerOntology:number; maxMappingsPerOntology:number; maxKnowledgeRecords:number; maxEvidencePerKnowledge:number; maxProvenanceNodes:number; maxTraversalDepth:number; maxReplayOperations:number; maxPayloadBytes:number; minCompatibilityConfidence:number; }
export interface SemanticConceptDefinition { conceptId:string; label:string; definition:string; deprecated?:boolean; }
export interface SemanticVersionMapping { mappingId:string; fromOntologyId:string; fromVersion:string; fromConceptId:string; toOntologyId:string; toVersion:string; toConceptId:string; relation:SemanticRelation; confidence:number; provenanceId:string; }
export interface OntologyVersionInput { ontologyId:string; version:string; namespace:string; concepts:SemanticConceptDefinition[]; mappings?:SemanticVersionMapping[]; lifecycle?:SemanticLifecycle; createdAt:string; }
export interface OntologyVersion extends OntologyVersionInput { mappings:SemanticVersionMapping[]; lifecycle:SemanticLifecycle; ontologyDigest:string; }
export interface SemanticCompatibilityResult { status:SemanticCompatibilityStatus; sourceOntologyId:string; sourceVersion:string; sourceConceptId:string; targetOntologyId:string; targetVersion:string; targetConceptId:string; confidence:number; relation?:SemanticRelation; mappingId?:string; decisionDigest:string; }
export interface EpistemicKnowledgeAssertionInput { subjectKey:string; predicate:string; objectValue:unknown; statement:string; status:EpistemicStatus; scope:string; validFrom:string; validUntil?:string; evidence:EvidenceRef[]; provenanceId:string; sourceKind?:KnowledgeSourceKind; ontologyId:string; ontologyVersion:string; supersedesKnowledgeId?:string; retractsKnowledgeId?:string; }
export interface EpistemicKnowledgeRecord extends EpistemicKnowledgeAssertionInput { knowledgeId:string; sourceKind:KnowledgeSourceKind; assertionDigest:string; }
export interface TemporalKnowledgeQueryResult { at:string; records:EpistemicKnowledgeRecord[]; contradictions:Array<{subjectKey:string;predicate:string;scope:string;knowledgeIds:string[]}>; }
export interface ProvenanceNodeInput { provenanceId:string; kind:ProvenanceNodeKind; label:string; recordedAt:string; parentIds:string[]; sourceIds:string[]; }
export interface ProvenanceNode extends ProvenanceNodeInput { nodeDigest:string; }
export interface SemanticOperation { operationId:string; kind:SemanticOperationKind; ontologyId:string; ontologyVersion:string; payload:unknown; occurredAt:string; }
export interface SemanticReplaySnapshot { ontologyId:string; ontologyVersion:string; operationCount:number; concepts:SemanticConceptDefinition[]; mappings:SemanticVersionMapping[]; knowledge:EpistemicKnowledgeRecord[]; snapshotDigest:string; }
export interface LegacyKnowledgeRecord { legacyId:string; statement:string; status:EpistemicStatus; scope:string; capturedAt:string; evidence:EvidenceRef[]; provenanceId:string; ontologyId:string; ontologyVersion:string; }
export interface LegacyHandoffResult { legacyId:string; knowledgeId:string; ontologyId:string; ontologyVersion:string; sourceKind:"LEGACY"; authorityWidened:false; }

export class KnowledgeSemanticError extends Error { constructor(readonly code:"INVALID_INPUT"|"IMMUTABILITY_VIOLATION"|"INVALID_LIFECYCLE"|"SEMANTIC_AMBIGUITY"|"RESOURCE_EXHAUSTED"|"REPLAY_MISMATCH"|"PROVENANCE_CYCLE"|"PROVENANCE_PARENT_MISSING"|"TEMPORAL_CONFLICT"|"AUTHORITY_BOUNDARY", message:string){super(message);this.name="KnowledgeSemanticError";} }
function text(name:string,value:string):void{if(value.length===0)throw new KnowledgeSemanticError("INVALID_INPUT",`${name} must not be empty`)}
function iso(name:string,value:string):void{if(!Number.isFinite(Date.parse(value)))throw new KnowledgeSemanticError("INVALID_INPUT",`${name} must be valid ISO time`)}
function finiteConfidence(value:number):void{if(!Number.isFinite(value)||value<0||value>1)throw new KnowledgeSemanticError("INVALID_INPUT","confidence must be between 0 and 1")}
function positiveLimit(name:string,value:number):void{if(!Number.isSafeInteger(value)||value<=0)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED",`${name} must be positive`)}
function clone<T>(value:T):T{return structuredClone(value)}
function bytes(value:unknown):number{return new TextEncoder().encode(stableStringify(value)).byteLength}
function key(ontologyId:string,version:string):string{return `${ontologyId}@${version}`}

const DEFAULT_LIMITS:KnowledgeSemanticLimits={maxOntologyVersions:100,maxConceptsPerOntology:1000,maxMappingsPerOntology:2000,maxKnowledgeRecords:10000,maxEvidencePerKnowledge:32,maxProvenanceNodes:20000,maxTraversalDepth:100,maxReplayOperations:20000,maxPayloadBytes:1000000,minCompatibilityConfidence:.8};
export function normalizeKnowledgeSemanticLimits(overrides:Partial<KnowledgeSemanticLimits>={}):KnowledgeSemanticLimits{const limits={...DEFAULT_LIMITS,...overrides};positiveLimit("maxOntologyVersions",limits.maxOntologyVersions);positiveLimit("maxConceptsPerOntology",limits.maxConceptsPerOntology);positiveLimit("maxMappingsPerOntology",limits.maxMappingsPerOntology);positiveLimit("maxKnowledgeRecords",limits.maxKnowledgeRecords);positiveLimit("maxEvidencePerKnowledge",limits.maxEvidencePerKnowledge);positiveLimit("maxProvenanceNodes",limits.maxProvenanceNodes);positiveLimit("maxTraversalDepth",limits.maxTraversalDepth);positiveLimit("maxReplayOperations",limits.maxReplayOperations);positiveLimit("maxPayloadBytes",limits.maxPayloadBytes);finiteConfidence(limits.minCompatibilityConfidence);return limits;}

export class VersionedOntologyRegistry{
  private readonly versions=new Map<string,OntologyVersion>();
  constructor(private readonly limits:KnowledgeSemanticLimits=normalizeKnowledgeSemanticLimits()){}
  register(input:OntologyVersionInput):OntologyVersion{
    text("ontologyId",input.ontologyId);text("version",input.version);text("namespace",input.namespace);iso("createdAt",input.createdAt);
    if(input.concepts.length>this.limits.maxConceptsPerOntology)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Concept count exceeds limit");
    if((input.mappings?.length??0)>this.limits.maxMappingsPerOntology)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Mapping count exceeds limit");
    const seen=new Set<string>();const concepts=input.concepts.map(c=>{text("conceptId",c.conceptId);text("label",c.label);text("definition",c.definition);if(seen.has(c.conceptId))throw new KnowledgeSemanticError("IMMUTABILITY_VIOLATION",`Duplicate concept ${c.conceptId}`);seen.add(c.conceptId);return clone(c)});
    const mappings=(input.mappings??[]).map(m=>{text("mappingId",m.mappingId);text("fromOntologyId",m.fromOntologyId);text("toOntologyId",m.toOntologyId);text("fromVersion",m.fromVersion);text("toVersion",m.toVersion);text("fromConceptId",m.fromConceptId);text("toConceptId",m.toConceptId);text("provenanceId",m.provenanceId);finiteConfidence(m.confidence);return clone(m)});
    const lifecycle=input.lifecycle??"DRAFT";const canonical={ontologyId:input.ontologyId,version:input.version,namespace:input.namespace,concepts,mappings,lifecycle,createdAt:new Date(input.createdAt).toISOString()};
    if(bytes(canonical)>this.limits.maxPayloadBytes)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Ontology payload exceeds limit");
    const ontologyDigest=digest(canonical),id=key(input.ontologyId,input.version),existing=this.versions.get(id);
    if(existing){if(existing.ontologyDigest!==ontologyDigest)throw new KnowledgeSemanticError("IMMUTABILITY_VIOLATION",`Ontology version ${id} is immutable`);return clone(existing)}
    if(this.versions.size>=this.limits.maxOntologyVersions)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Ontology version limit exceeded");
    const record:OntologyVersion={...canonical,ontologyDigest};this.versions.set(id,clone(record));return clone(record);
  }
  transition(ontologyId:string,version:string,target:SemanticLifecycle):OntologyVersion{
    const id=key(ontologyId,version),current=this.versions.get(id);if(!current)throw new KnowledgeSemanticError("INVALID_INPUT",`Ontology version ${id} not found`);if(target===current.lifecycle)return clone(current);
    const allowed=(current.lifecycle==="DRAFT"&&target==="ACTIVE")||(current.lifecycle==="ACTIVE"&&target==="RETIRED");if(!allowed)throw new KnowledgeSemanticError("INVALID_LIFECYCLE",`Invalid lifecycle transition ${current.lifecycle} -> ${target}`);
    const canonical={...current,lifecycle:target};const immutableDigest=digest({ontologyId:current.ontologyId,version:current.version,namespace:current.namespace,concepts:current.concepts,mappings:current.mappings,lifecycle:target,createdAt:current.createdAt});const updated:OntologyVersion={...canonical,ontologyDigest:immutableDigest};this.versions.set(id,clone(updated));return clone(updated);
  }
  get(ontologyId:string,version:string):OntologyVersion|undefined{const x=this.versions.get(key(ontologyId,version));return x?clone(x):undefined}
  all():OntologyVersion[]{return [...this.versions.values()].map(clone)}
  hasConcept(ontologyId:string,version:string,conceptId:string):boolean{return Boolean(this.versions.get(key(ontologyId,version))?.concepts.some(c=>c.conceptId===conceptId))}
  digest(ontologyId:string,version:string):string{const x=this.versions.get(key(ontologyId,version));if(!x)throw new KnowledgeSemanticError("INVALID_INPUT","Ontology version not found");return x.ontologyDigest}
}

export class SemanticCompatibilityEngine{
  constructor(private readonly ontologies:VersionedOntologyRegistry,private readonly limits:KnowledgeSemanticLimits=normalizeKnowledgeSemanticLimits()){}
  resolve(args:{sourceOntologyId:string;sourceVersion:string;sourceConceptId:string;targetOntologyId:string;targetVersion:string;targetConceptId:string}):SemanticCompatibilityResult{
    Object.values(args).forEach(v=>text("compatibility field",v));
    if(!this.ontologies.hasConcept(args.sourceOntologyId,args.sourceVersion,args.sourceConceptId)||!this.ontologies.hasConcept(args.targetOntologyId,args.targetVersion,args.targetConceptId))throw new KnowledgeSemanticError("INVALID_INPUT","Compatibility concept not found");
    let result:Omit<SemanticCompatibilityResult,"decisionDigest">;const same=args.sourceOntologyId===args.targetOntologyId&&args.sourceVersion===args.targetVersion&&args.sourceConceptId===args.targetConceptId;
    if(same)result={...args,status:"EXACT",confidence:1};else{const source=this.ontologies.get(args.sourceOntologyId,args.sourceVersion)!;const candidates=source.mappings.filter(m=>m.fromOntologyId===args.sourceOntologyId&&m.fromVersion===args.sourceVersion&&m.fromConceptId===args.sourceConceptId&&m.toOntologyId===args.targetOntologyId&&m.toVersion===args.targetVersion&&m.toConceptId===args.targetConceptId);
      if(candidates.length===0)result={...args,status:"INCOMPATIBLE",confidence:0};else if(candidates.length>1)result={...args,status:"INDETERMINATE",confidence:Math.max(...candidates.map(x=>x.confidence))};else{const m=candidates[0]!;if(m.confidence<this.limits.minCompatibilityConfidence||m.relation==="approximate"||m.relation==="conditional")result={...args,status:"INDETERMINATE",confidence:m.confidence,relation:m.relation,mappingId:m.mappingId};else result={...args,status:"COMPATIBLE",confidence:m.confidence,relation:m.relation,mappingId:m.mappingId}}
    }
    return {...clone(result),decisionDigest:digest(result)};
  }
}

export class EpistemicKnowledgeStore{
  private readonly records=new Map<string,EpistemicKnowledgeRecord>();
  constructor(private readonly limits:KnowledgeSemanticLimits=normalizeKnowledgeSemanticLimits()){}
  assert(input:EpistemicKnowledgeAssertionInput):EpistemicKnowledgeRecord{
    text("subjectKey",input.subjectKey);text("predicate",input.predicate);text("statement",input.statement);text("scope",input.scope);text("provenanceId",input.provenanceId);text("ontologyId",input.ontologyId);text("ontologyVersion",input.ontologyVersion);iso("validFrom",input.validFrom);if(input.validUntil!==undefined)iso("validUntil",input.validUntil);
    if(input.validUntil!==undefined&&Date.parse(input.validUntil)<=Date.parse(input.validFrom))throw new KnowledgeSemanticError("INVALID_INPUT","validUntil must be after validFrom");
    if(input.evidence.length>this.limits.maxEvidencePerKnowledge)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Evidence count exceeds limit");if(input.evidence.length===0&&input.status!=="unknown")throw new KnowledgeSemanticError("INVALID_INPUT","Qualified knowledge requires evidence");
    input.evidence.forEach(e=>{text("evidenceId",e.evidenceId);text("sourceId",e.sourceId);finiteConfidence(e.confidence)});
    const canonical={...input,sourceKind:input.sourceKind??"LOCAL",validFrom:new Date(input.validFrom).toISOString(),...(input.validUntil===undefined?{}:{validUntil:new Date(input.validUntil).toISOString()}),evidence:input.evidence.map(clone)};
    if(bytes(canonical)>this.limits.maxPayloadBytes)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Knowledge payload exceeds limit");
    const assertionDigest=digest(canonical),knowledgeId=assertionDigest,existing=this.records.get(knowledgeId);if(existing)return clone(existing);if(this.records.size>=this.limits.maxKnowledgeRecords)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Knowledge record limit exceeded");
    const record:EpistemicKnowledgeRecord={...canonical,knowledgeId,assertionDigest};this.records.set(knowledgeId,clone(record));return clone(record);
  }
  get(id:string):EpistemicKnowledgeRecord|undefined{const x=this.records.get(id);return x?clone(x):undefined}
  all():EpistemicKnowledgeRecord[]{return [...this.records.values()].map(clone)}
  historyFor(subjectKey:string):EpistemicKnowledgeRecord[]{return this.all().filter(x=>x.subjectKey===subjectKey)}
  queryAt(subjectKey:string,at:string):TemporalKnowledgeQueryResult{
    text("subjectKey",subjectKey);iso("at",at);const t=Date.parse(at);const history=this.historyFor(subjectKey);
    const active=(x:EpistemicKnowledgeRecord)=>{const from=Date.parse(x.validFrom),until=x.validUntil===undefined?Infinity:Date.parse(x.validUntil);return from<=t&&t<until};
    const activeControls=history.filter(active);const superseded=new Set(activeControls.map(x=>x.supersedesKnowledgeId).filter((x):x is string=>x!==undefined));const retracted=new Set(activeControls.map(x=>x.retractsKnowledgeId).filter((x):x is string=>x!==undefined));
    const records=activeControls.filter(x=>!superseded.has(x.knowledgeId)&&!retracted.has(x.knowledgeId)&&x.retractsKnowledgeId===undefined).sort((a,b)=>a.knowledgeId.localeCompare(b.knowledgeId));
    const groups=new Map<string,EpistemicKnowledgeRecord[]>();for(const record of records){const group=`${record.subjectKey}\u0000${record.predicate}\u0000${record.scope}`;const list=groups.get(group)??[];list.push(record);groups.set(group,list)}
    const contradictions=[...groups.values()].filter(list=>new Set(list.map(x=>stableStringify(x.objectValue))).size>1).map(list=>({subjectKey:list[0]!.subjectKey,predicate:list[0]!.predicate,scope:list[0]!.scope,knowledgeIds:list.map(x=>x.knowledgeId).sort()}));
    return {at:new Date(at).toISOString(),records:clone(records),contradictions:clone(contradictions)};
  }
  assertNoContradiction(subjectKey:string,at:string):void{if(this.queryAt(subjectKey,at).contradictions.length>0)throw new KnowledgeSemanticError("TEMPORAL_CONFLICT","Contradictory knowledge is active at the requested time")}
}

export class ProvenanceGraph{
  private readonly nodes=new Map<string,ProvenanceNode>();
  constructor(private readonly limits:KnowledgeSemanticLimits=normalizeKnowledgeSemanticLimits()){}
  add(input:ProvenanceNodeInput):ProvenanceNode{
    text("provenanceId",input.provenanceId);text("label",input.label);iso("recordedAt",input.recordedAt);if(this.nodes.size>=this.limits.maxProvenanceNodes&&!this.nodes.has(input.provenanceId))throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Provenance node limit exceeded");if(input.parentIds.includes(input.provenanceId))throw new KnowledgeSemanticError("PROVENANCE_CYCLE","A provenance node cannot parent itself");for(const p of input.parentIds)if(!this.nodes.has(p))throw new KnowledgeSemanticError("PROVENANCE_PARENT_MISSING",`Missing provenance parent ${p}`);if(this.wouldCycle(input.provenanceId,input.parentIds))throw new KnowledgeSemanticError("PROVENANCE_CYCLE","Provenance cycle rejected");
    const canonical={...input,parentIds:[...new Set(input.parentIds)].sort(),sourceIds:[...new Set(input.sourceIds)].sort(),recordedAt:new Date(input.recordedAt).toISOString()},nodeDigest=digest(canonical),existing=this.nodes.get(input.provenanceId);if(existing){if(existing.nodeDigest!==nodeDigest)throw new KnowledgeSemanticError("IMMUTABILITY_VIOLATION","Provenance node is immutable");return clone(existing)}const node:ProvenanceNode={...canonical,nodeDigest};this.nodes.set(input.provenanceId,clone(node));return clone(node);
  }
  private wouldCycle(nodeId:string,parentIds:string[]):boolean{const stack=[...parentIds],seen=new Set<string>();let steps=0;while(stack.length){if(++steps>this.limits.maxTraversalDepth*Math.max(1,this.nodes.size))throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Provenance cycle analysis exceeded bound");const id=stack.pop()!;if(id===nodeId)return true;if(seen.has(id))continue;seen.add(id);const node=this.nodes.get(id);if(node)stack.push(...node.parentIds)}return false}
  ancestors(nodeId:string,maxDepth=this.limits.maxTraversalDepth):ProvenanceNode[]{if(!this.nodes.has(nodeId))throw new KnowledgeSemanticError("INVALID_INPUT",`Provenance node ${nodeId} not found`);if(!Number.isSafeInteger(maxDepth)||maxDepth<=0||maxDepth>this.limits.maxTraversalDepth)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Traversal depth exceeds limit");const out:ProvenanceNode[]=[],queue=this.nodes.get(nodeId)!.parentIds.map(id=>({id,depth:1})),seen=new Set<string>();while(queue.length){const cur=queue.shift()!;if(cur.depth>maxDepth||seen.has(cur.id))continue;seen.add(cur.id);const node=this.nodes.get(cur.id);if(!node)continue;out.push(clone(node));for(const p of node.parentIds)queue.push({id:p,depth:cur.depth+1})}return out.sort((a,b)=>a.provenanceId.localeCompare(b.provenanceId))}
  get(id:string):ProvenanceNode|undefined{const x=this.nodes.get(id);return x?clone(x):undefined}all():ProvenanceNode[]{return [...this.nodes.values()].map(clone)}graphDigest():string{return digest(this.all().sort((a,b)=>a.provenanceId.localeCompare(b.provenanceId)))}
}

export class SemanticReplayLog{
  private readonly operations:SemanticOperation[]=[];
  constructor(private readonly limits:KnowledgeSemanticLimits=normalizeKnowledgeSemanticLimits()){}
  append(input:Omit<SemanticOperation,"operationId">):SemanticOperation{text("ontologyId",input.ontologyId);text("ontologyVersion",input.ontologyVersion);iso("occurredAt",input.occurredAt);if(this.operations.length>=this.limits.maxReplayOperations)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Replay operation limit exceeded");const canonical={kind:input.kind,ontologyId:input.ontologyId,ontologyVersion:input.ontologyVersion,payload:clone(input.payload),occurredAt:new Date(input.occurredAt).toISOString(),sequence:this.operations.length+1};if(bytes(canonical)>this.limits.maxPayloadBytes)throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED","Replay payload exceeds limit");const operationId=digest({previous:this.operations.length===0?null:this.operations[this.operations.length-1]!.operationId,canonical}),operation={...canonical,operationId};this.operations.push(clone(operation));return clone(operation)}
  replay(ontologyId:string,ontologyVersion:string,expectedSnapshotDigest?:string):SemanticReplaySnapshot{const filtered=this.operations.filter(x=>x.ontologyId===ontologyId&&x.ontologyVersion===ontologyVersion),concepts=new Map<string,SemanticConceptDefinition>(),mappings=new Map<string,SemanticVersionMapping>(),knowledge=new Map<string,EpistemicKnowledgeRecord>();for(const op of filtered){if(op.kind==="CONCEPT")concepts.set((op.payload as SemanticConceptDefinition).conceptId,clone(op.payload as SemanticConceptDefinition));else if(op.kind==="MAPPING")mappings.set((op.payload as SemanticVersionMapping).mappingId,clone(op.payload as SemanticVersionMapping));else knowledge.set((op.payload as EpistemicKnowledgeRecord).knowledgeId,clone(op.payload as EpistemicKnowledgeRecord))}const snapshotBase={ontologyId,ontologyVersion,operationCount:filtered.length,concepts:[...concepts.values()].sort((a,b)=>a.conceptId.localeCompare(b.conceptId)),mappings:[...mappings.values()].sort((a,b)=>a.mappingId.localeCompare(b.mappingId)),knowledge:[...knowledge.values()].sort((a,b)=>a.knowledgeId.localeCompare(b.knowledgeId))},snapshotDigest=digest(snapshotBase);if(expectedSnapshotDigest!==undefined&&expectedSnapshotDigest!==snapshotDigest)throw new KnowledgeSemanticError("REPLAY_MISMATCH","Semantic replay digest does not match expected identity");return {...clone(snapshotBase),snapshotDigest}}
  all():SemanticOperation[]{return this.operations.map(clone)}
}

export class LegacyKnowledgeHandoff{
  constructor(private readonly knowledge:EpistemicKnowledgeStore){}
  adopt(record:LegacyKnowledgeRecord):LegacyHandoffResult{text("legacyId",record.legacyId);text("statement",record.statement);text("scope",record.scope);text("provenanceId",record.provenanceId);text("ontologyId",record.ontologyId);text("ontologyVersion",record.ontologyVersion);iso("capturedAt",record.capturedAt);const adopted=this.knowledge.assert({subjectKey:`legacy:${record.legacyId}`,predicate:"legacy.statement",objectValue:record.statement,statement:record.statement,status:record.status,scope:record.scope,validFrom:record.capturedAt,evidence:record.evidence,provenanceId:record.provenanceId,sourceKind:"LEGACY",ontologyId:record.ontologyId,ontologyVersion:record.ontologyVersion});return {legacyId:record.legacyId,knowledgeId:adopted.knowledgeId,ontologyId:adopted.ontologyId,ontologyVersion:adopted.ontologyVersion,sourceKind:"LEGACY",authorityWidened:false}}
  assertNoAuthorityWidening():never{throw new KnowledgeSemanticError("AUTHORITY_BOUNDARY","Knowledge handoff does not itself grant authority")}
}
