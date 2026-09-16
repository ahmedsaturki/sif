import { createHash, randomUUID } from "node:crypto";
import type { AppendCondition, AuthorityGrant, Capability, EventEnvelope, EventStore, EvaluationResult, EvidenceRef, ISODate, KnowledgeObject, LineageNode, RecoveryManifest, SemanticConcept, SemanticMapping } from "./types.js";

export function now(): ISODate { return new Date().toISOString(); }
export class ConcurrencyError extends Error { constructor(message:string){super(message);this.name="ConcurrencyError";} }
export class AuthorizationError extends Error { constructor(message:string){super(message);this.name="AuthorizationError";} }
export class IntegrityError extends Error { constructor(message:string){super(message);this.name="IntegrityError";} }

export class InMemoryEventStore implements EventStore {
  private readonly events: EventEnvelope<Record<string,unknown>>[]=[];
  private readonly versions=new Map<string,number>();
  append<T extends Record<string,unknown>>(event:EventEnvelope<T>,condition:AppendCondition):void{const current=this.streamVersion(event.streamId);if(current!==condition.expectedStreamVersion||event.streamVersion!==current+1)throw new ConcurrencyError(`Stream ${event.streamId} expected ${condition.expectedStreamVersion}; current=${current}; event=${event.streamVersion}`);this.events.push(structuredClone(event));this.versions.set(event.streamId,event.streamVersion);}
  read(streamId:string,fromVersion=1):EventEnvelope<Record<string,unknown>>[]{return this.events.filter(e=>e.streamId===streamId&&e.streamVersion>=fromVersion).map(e=>structuredClone(e));}
  all():EventEnvelope<Record<string,unknown>>[]{return this.events.map(e=>structuredClone(e));}
  streamVersion(streamId:string):number{return this.versions.get(streamId)??0;}
}

function stableKeyCompare(a:string,b:string):number{return a<b?-1:a>b?1:0;}
function stableValue(value:unknown):unknown{if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>stableKeyCompare(a,b)).map(([k,v])=>[k,stableValue(v)]));return value;}
export function stableStringify(value:unknown):string{return JSON.stringify(stableValue(value));}
export function digest(value:unknown):string{return createHash("sha256").update(stableStringify(value)).digest("hex");}
export function cryptoRandomId():string{return randomUUID();}

export class SifEventWriter {
  constructor(private readonly store:EventStore){}
  write<T extends Record<string,unknown>>(args:{streamId:string;eventType:string;actorId:string;correlationId:string;payload:T;occurredAt?:ISODate;observedAt?:ISODate;effectiveAt?:ISODate;causationId?:string}):EventEnvelope<T>{const version=this.store.streamVersion(args.streamId)+1;const event:EventEnvelope<T>={eventId:cryptoRandomId(),eventType:args.eventType,streamId:args.streamId,streamVersion:version,occurredAt:args.occurredAt??now(),observedAt:args.observedAt??now(),...(args.effectiveAt===undefined?{}:{effectiveAt:args.effectiveAt}),actorId:args.actorId,correlationId:args.correlationId,...(args.causationId===undefined?{}:{causationId:args.causationId}),payload:structuredClone(args.payload)};this.store.append(event,{expectedStreamVersion:version-1});return event;}
}

export class EvidenceRegistry {
  private readonly records=new Map<string,EvidenceRef>();
  register(record:EvidenceRef):void{if(record.confidence<0||record.confidence>1)throw new RangeError("Evidence confidence must be between 0 and 1");this.records.set(record.evidenceId,structuredClone(record));}
  get(id:string):EvidenceRef|undefined{return this.records.get(id);}
  all():EvidenceRef[]{return [...this.records.values()].map(x=>structuredClone(x));}
}
export class KnowledgeRegistry {
  private readonly knowledge=new Map<string,KnowledgeObject>();
  put(item:KnowledgeObject):void{if(item.evidence.length===0&&item.kind!=="unknown")throw new IntegrityError("Qualified knowledge requires evidence");if(item.provenance.provenanceId.length===0)throw new IntegrityError("Knowledge requires provenance");this.knowledge.set(item.knowledgeId,structuredClone(item));}
  get(id:string):KnowledgeObject|undefined{return this.knowledge.get(id);}
  all():KnowledgeObject[]{return [...this.knowledge.values()].map(x=>structuredClone(x));}
  dependentsOf(id:string):KnowledgeObject[]{return this.all().filter(k=>k.parentKnowledgeIds.includes(id));}
}
export class SemanticRegistry {
  private readonly concepts=new Map<string,SemanticConcept>();private readonly mappings=new Map<string,SemanticMapping>();
  registerConcept(concept:SemanticConcept):void{this.concepts.set(`${concept.namespace}:${concept.conceptId}:${concept.version}`,structuredClone(concept));}
  registerMapping(mapping:SemanticMapping):void{if(mapping.confidence<0||mapping.confidence>1)throw new RangeError("Mapping confidence must be between 0 and 1");this.mappings.set(mapping.mappingId,structuredClone(mapping));}
  find(namespace:string,conceptId:string,version:string):SemanticConcept|undefined{return this.concepts.get(`${namespace}:${conceptId}:${version}`);}
  mapping(id:string):SemanticMapping|undefined{return this.mappings.get(id);}
  allConcepts():SemanticConcept[]{return [...this.concepts.values()].map(x=>structuredClone(x));}
  allMappings():SemanticMapping[]{return [...this.mappings.values()].map(x=>structuredClone(x));}
}
function scopeAllows(grantScope:string,requestedScope:string):boolean{if(grantScope==="*")return true;if(grantScope===requestedScope)return true;const prefix=grantScope.endsWith("/")?grantScope:`${grantScope}/`;return requestedScope.startsWith(prefix);}
export class AuthorityRegistry {
  private readonly grants=new Map<string,AuthorityGrant>();
  grant(grant:AuthorityGrant):void{if(grant.expiresAt&&Date.parse(grant.expiresAt)<=Date.parse(grant.issuedAt))throw new RangeError("Authority expiry must be after issuance");if(grant.parentGrantId){const parent=this.grants.get(grant.parentGrantId);if(!parent)throw new AuthorizationError("Parent grant not found");if(grant.issuerId!==parent.subjectId)throw new AuthorizationError("Delegation issuer must be the parent grant subject");if(!grant.capabilities.every(c=>parent.capabilities.includes(c)))throw new AuthorizationError("Delegation cannot increase capabilities");if(parent.expiresAt&&!grant.expiresAt)throw new AuthorizationError("Delegated authority must not outlive its parent");if(grant.expiresAt&&parent.expiresAt&&Date.parse(grant.expiresAt)>Date.parse(parent.expiresAt))throw new AuthorizationError("Delegation cannot extend authority lifetime");if(!scopeAllows(parent.scope,grant.scope))throw new AuthorizationError("Delegation cannot expand scope");}this.grants.set(grant.grantId,structuredClone(grant));}
  can(subjectId:string,capability:string,at=now(),requestedScope?:string):boolean{const t=Date.parse(at);return [...this.grants.values()].some(g=>g.subjectId===subjectId&&g.capabilities.includes(capability)&&t>=Date.parse(g.issuedAt)&&(!g.expiresAt||t<Date.parse(g.expiresAt))&&(requestedScope===undefined||scopeAllows(g.scope,requestedScope)));}
  all():AuthorityGrant[]{return [...this.grants.values()].map(x=>structuredClone(x));}
}
export class GovernedExecutor {constructor(private readonly authority:AuthorityRegistry,private readonly capabilities:CapabilityRegistry){}execute<T>(args:{subjectId:string;capabilityId:string;scope:string;action:()=>T;at?:ISODate}):T{const at=args.at??now();if(!this.capabilities.usable(args.capabilityId))throw new AuthorizationError(`Capability ${args.capabilityId} is not admitted for execution`);if(!this.authority.can(args.subjectId,args.capabilityId,at,args.scope))throw new AuthorizationError(`Subject ${args.subjectId} lacks authority for ${args.capabilityId} at ${args.scope}`);return args.action();}}
export class CapabilityRegistry {private readonly capabilities=new Map<string,Capability>();register(capability:Capability):void{this.capabilities.set(capability.capabilityId,structuredClone(capability));}get(id:string):Capability|undefined{return this.capabilities.get(id);}usable(id:string):boolean{const c=this.capabilities.get(id);return Boolean(c?.available&&c.usable&&c.verified&&c.authorized&&c.healthy);}all():Capability[]{return [...this.capabilities.values()].map(x=>structuredClone(x));}}
export class LineageRegistry {private readonly nodes=new Map<string,LineageNode>();add(node:LineageNode):void{if(node.parentNodeId&&!this.nodes.has(node.parentNodeId))throw new IntegrityError("Lineage parent does not exist");this.nodes.set(node.nodeId,structuredClone(node));}get(id:string):LineageNode|undefined{return this.nodes.get(id);}childrenOf(id:string):LineageNode[]{return [...this.nodes.values()].filter(n=>n.parentNodeId===id).map(x=>structuredClone(x));}all():LineageNode[]{return [...this.nodes.values()].map(x=>structuredClone(x));}}
export class ReconstructionVerifier {verify(manifest:RecoveryManifest,store:EventStore,semantics:SemanticRegistry,authority:AuthorityRegistry):EvaluationResult{const checks={eventStreamsPresent:manifest.eventStreams.every(s=>store.read(s).length>0),semanticRegistryPresent:semantics.allConcepts().length>0,authorityPresent:authority.all().some(g=>g.subjectId===manifest.identityId),trustAnchorsDeclared:manifest.trustAnchors.length>0,artifactsDeclared:manifest.artifactDigests.length>0,policyDeclared:manifest.policyVersion.length>0};return{evaluationId:cryptoRandomId(),subjectId:manifest.identityId,suite:"reconstruction-integrity",passed:Object.values(checks).every(Boolean),checks,measuredAt:now()};}}
export class Projection<TState>{constructor(private readonly initial:()=>TState,private readonly apply:(state:TState,event:EventEnvelope)=>TState){}rebuild(events:EventEnvelope[]):TState{return events.slice().sort((a,b)=>a.streamVersion-b.streamVersion).reduce((state,event)=>this.apply(state,event),this.initial());}}
