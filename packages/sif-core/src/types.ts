export type ISODate = string;

export interface EventEnvelope<TPayload extends object = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  streamId: string;
  streamVersion: number;
  occurredAt: ISODate;
  observedAt: ISODate;
  effectiveAt?: ISODate;
  actorId: string;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
  metadata?: Record<string, string>;
}

export interface AppendCondition { expectedStreamVersion: number; }

export interface EventStore {
  append<T extends Record<string, unknown>>(event: EventEnvelope<T>, condition: AppendCondition): void;
  read(streamId: string, fromVersion?: number): EventEnvelope[];
  all(): EventEnvelope[];
  streamVersion(streamId: string): number;
}

export type EpistemicStatus = "observed"|"measured"|"derived"|"supported"|"contested"|"uncertain"|"inferred"|"simulated"|"hypothetical"|"unknown";

export interface EvidenceRef { evidenceId:string; sourceId:string; digest:string; capturedAt:ISODate; scope:string; confidence:number; }
export interface ProvenanceRecord { provenanceId:string; sourceIds:string[]; activity:string; actorId:string; capturedAt:ISODate; parentIds:string[]; }
export interface KnowledgeObject { knowledgeId:string; kind:"fact"|"observation"|"inference"|"hypothesis"|"pattern"|"lesson"|"rule"|"principle"|"procedure"|"unknown"; statement:string; status:EpistemicStatus; scope:string; validFrom:ISODate; validUntil?:ISODate; evidence:EvidenceRef[]; provenance:ProvenanceRecord; parentKnowledgeIds:string[]; }
export interface SemanticConcept { conceptId:string; namespace:string; version:string; label:string; definition:string; deprecated?:boolean; }
export interface SemanticMapping { mappingId:string; fromConceptId:string; toConceptId:string; relation:"equivalent"|"broader"|"narrower"|"related"|"approximate"|"conditional"; confidence:number; provenanceId:string; }
export interface AuthorityGrant { grantId:string; subjectId:string; scope:string; capabilities:string[]; issuedAt:ISODate; expiresAt?:ISODate; issuerId:string; parentGrantId?:string; }
export interface Capability { capabilityId:string; name:string; version:string; available:boolean; usable:boolean; verified:boolean; authorized:boolean; healthy:boolean; }
export interface LineageNode { nodeId:string; identityId:string; parentNodeId?:string; kind:"birth"|"version"|"fork"|"merge"|"reconstruction"|"successor"|"retirement"; createdAt:ISODate; evidenceIds:string[]; }
export interface RecoveryManifest { identityId:string; artifactDigests:string[]; eventStreams:string[]; trustAnchors:string[]; policyVersion:string; semanticRegistryVersion:string; }
export interface EvaluationResult { evaluationId:string; subjectId:string; suite:string; passed:boolean; checks:Record<string,boolean>; measuredAt:ISODate; }
