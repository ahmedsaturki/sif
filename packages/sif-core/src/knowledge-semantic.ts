import { digest, stableStringify } from "./core.js";

export type OntologyLifecycle = "REGISTERED" | "ACTIVE" | "RETIRED";
export type SemanticCompatibility = "EXACT" | "BACKWARD_COMPATIBLE" | "INCOMPATIBLE" | "UNKNOWN";
export type EpistemicStatus = "KNOWN" | "SUPPORTED" | "UNCERTAIN" | "DISPUTED" | "REJECTED";
export type ProvenanceNodeKind = "SOURCE" | "CLAIM" | "DERIVATION" | "EVENT";
export type ProvenanceEdgeKind = "SUPPORTS" | "DERIVED_FROM" | "CONTRADICTS" | "ASSERTS";

export interface KnowledgeSemanticLimits {
  maxOntologyVersions: number;
  maxConcepts: number;
  maxRelations: number;
  maxSemanticContextBytes: number;
  maxEpistemicSources: number;
  maxProvenanceNodes: number;
  maxProvenanceEdges: number;
  maxReplayBytes: number;
  maxHandoffRecords: number;
}

export interface SemanticConcept {
  id: string;
  kind: string;
  labels: string[];
  metadata?: Record<string, string>;
}

export interface SemanticRelation {
  id: string;
  subject: string;
  predicate: string;
  object: string;
}

export interface OntologyVersion {
  ontologyId: string;
  version: string;
  lifecycle: OntologyLifecycle;
  effectiveFrom: string;
  effectiveTo?: string;
  concepts: SemanticConcept[];
  relations: SemanticRelation[];
  digest: string;
}

export interface OntologyRegistration {
  ontologyId: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  lifecycle?: OntologyLifecycle;
  concepts: SemanticConcept[];
  relations: SemanticRelation[];
}

export interface CompatibilityResult {
  compatibility: SemanticCompatibility;
  sourceOntologyDigest: string;
  targetOntologyDigest: string;
  reason: string;
}

export interface EpistemicSource {
  sourceId: string;
  sourceDigest: string;
  observedAt: string;
}

export interface EpistemicState {
  stateId: string;
  subject: string;
  proposition: string;
  status: EpistemicStatus;
  confidence: number;
  sources: EpistemicSource[];
  observedAt: string;
  derivedFrom?: string[];
  digest: string;
}

export interface ProvenanceNode {
  id: string;
  kind: ProvenanceNodeKind;
  digest: string;
}

export interface ProvenanceEdge {
  from: string;
  to: string;
  kind: ProvenanceEdgeKind;
}

export interface ProvenanceGraphSnapshot {
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
  digest: string;
}

export interface SemanticReplayDescriptor {
  ontologyId: string;
  ontologyVersion: string;
  ontologyDigest: string;
  epistemicDigest: string;
  provenanceDigest: string;
  subject: string;
  proposition: string;
}

export interface LegacyKnowledgeRecord {
  legacyId: string;
  sourceSystem: string;
  payload: unknown;
  sourceDigest: string;
}

export interface LegacyKnowledgeMapping {
  legacyId: string;
  conceptId: string;
  mappedFields: Record<string, string>;
}

export interface KnowledgeHandoffResult {
  handoffId: string;
  accepted: boolean;
  preservedSourceDigest: string;
  mappings: LegacyKnowledgeMapping[];
  unmapped: string[];
  evidenceDigest: string;
}

export class KnowledgeSemanticError extends Error {
  constructor(readonly code:
    | "INVALID_SEMANTIC"
    | "RESOURCE_EXHAUSTED"
    | "ONTOLOGY_NOT_FOUND"
    | "ONTOLOGY_AMBIGUOUS"
    | "INCOMPATIBLE_SEMANTICS"
    | "INVALID_EPISTEMIC"
    | "PROVENANCE_CYCLE"
    | "REPLAY_MISMATCH"
    | "HANDOFF_INCOMPLETE"
  , message: string) {
    super(message);
    this.name = "KnowledgeSemanticError";
  }
}

function text(name: string, value: string): void {
  if (value.length === 0) throw new KnowledgeSemanticError("INVALID_SEMANTIC", `${name} must not be empty`);
}
function iso(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new KnowledgeSemanticError("INVALID_SEMANTIC", `${name} must be valid time`);
}
function positive(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED", `${name} must be positive`);
}
function bounded(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new KnowledgeSemanticError("INVALID_EPISTEMIC", `${name} must be between 0 and 1`);
}
function bytes(value: unknown): number { return new TextEncoder().encode(stableStringify(value)).byteLength; }
function clone<T>(value: T): T { return structuredClone(value); }
function parseVersion(value: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) throw new KnowledgeSemanticError("INVALID_SEMANTIC", "Ontology version must use x.y.z");
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function createOntologyVersion(registration: OntologyRegistration, limits: KnowledgeSemanticLimits): OntologyVersion {
  text("ontologyId", registration.ontologyId); text("version", registration.version); iso("effectiveFrom", registration.effectiveFrom);
  parseVersion(registration.version);
  if (registration.effectiveTo !== undefined) iso("effectiveTo", registration.effectiveTo);
  if (registration.effectiveTo !== undefined && Date.parse(registration.effectiveTo) <= Date.parse(registration.effectiveFrom)) throw new KnowledgeSemanticError("INVALID_SEMANTIC", "effectiveTo must be after effectiveFrom");
  if (registration.concepts.length > limits.maxConcepts || registration.relations.length > limits.maxRelations) throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED", "Ontology resource limit exceeded");
  const concepts = clone(registration.concepts).map((x) => ({ ...x, labels: [...x.labels], ...(x.metadata === undefined ? {} : { metadata: clone(x.metadata) }) }));
  const relations = clone(registration.relations);
  const identity = {
    ontologyId: registration.ontologyId,
    version: registration.version,
    effectiveFrom: new Date(registration.effectiveFrom).toISOString(),
    ...(registration.effectiveTo === undefined ? {} : { effectiveTo: new Date(registration.effectiveTo).toISOString() }),
    lifecycle: registration.lifecycle ?? "REGISTERED",
    concepts,
    relations,
  };
  const result: OntologyVersion = { ...identity, digest: digest(identity) };
  if (bytes(result) > limits.maxSemanticContextBytes) throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED", "Ontology exceeds semantic context limit");
  return result;
}

export class OntologyRegistry {
  private readonly versions: OntologyVersion[] = [];
  constructor(private readonly limits: KnowledgeSemanticLimits) { positive("maxOntologyVersions", limits.maxOntologyVersions); }
  register(version: OntologyVersion): void {
    if (this.versions.length >= this.limits.maxOntologyVersions) throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED", "Ontology version limit exceeded");
    if (this.versions.some((x) => x.ontologyId === version.ontologyId && x.version === version.version)) throw new KnowledgeSemanticError("INVALID_SEMANTIC", "Duplicate ontology version");
    this.versions.push(clone(version));
  }
  activate(ontologyId: string, version: string): void {
    const item = this.require(ontologyId, version);
    if (this.versions.some((x) => x.ontologyId === ontologyId && x.lifecycle === "ACTIVE" && x.version !== version && this.overlaps(x, item))) throw new KnowledgeSemanticError("ONTOLOGY_AMBIGUOUS", "Overlapping active ontology versions");
    item.lifecycle = "ACTIVE";
  }
  retire(ontologyId: string, version: string): void { this.require(ontologyId, version).lifecycle = "RETIRED"; }
  resolve(ontologyId: string, at: string): OntologyVersion {
    iso("at", at);
    const ts = Date.parse(at);
    const matches = this.versions.filter((x) => x.ontologyId === ontologyId && x.lifecycle !== "RETIRED" && Date.parse(x.effectiveFrom) <= ts && (x.effectiveTo === undefined || ts < Date.parse(x.effectiveTo)));
    if (matches.length === 0) throw new KnowledgeSemanticError("ONTOLOGY_NOT_FOUND", "No ontology version applies at the requested time");
    if (matches.length !== 1) throw new KnowledgeSemanticError("ONTOLOGY_AMBIGUOUS", "Multiple ontology versions apply at the requested time");
    return clone(matches[0]!);
  }
  all(): OntologyVersion[] { return this.versions.map(clone); }
  private require(ontologyId: string, version: string): OntologyVersion { const item = this.versions.find((x) => x.ontologyId === ontologyId && x.version === version); if (!item) throw new KnowledgeSemanticError("ONTOLOGY_NOT_FOUND", "Ontology version not found"); return item; }
  private overlaps(a: OntologyVersion, b: OntologyVersion): boolean {
    const start = Math.max(Date.parse(a.effectiveFrom), Date.parse(b.effectiveFrom));
    const endA = a.effectiveTo === undefined ? Number.POSITIVE_INFINITY : Date.parse(a.effectiveTo);
    const endB = b.effectiveTo === undefined ? Number.POSITIVE_INFINITY : Date.parse(b.effectiveTo);
    return start < Math.min(endA, endB);
  }
}

export function compareOntologySemantics(source: OntologyVersion, target: OntologyVersion): CompatibilityResult {
  const [sMajor, sMinor] = parseVersion(source.version);
  const [tMajor, tMinor] = parseVersion(target.version);
  if (source.ontologyId !== target.ontologyId) return { compatibility: "INCOMPATIBLE", sourceOntologyDigest: source.digest, targetOntologyDigest: target.digest, reason: "Different ontology identifiers" };
  if (source.digest === target.digest) return { compatibility: "EXACT", sourceOntologyDigest: source.digest, targetOntologyDigest: target.digest, reason: "Identical ontology identity" };
  if (sMajor !== tMajor) return { compatibility: "INCOMPATIBLE", sourceOntologyDigest: source.digest, targetOntologyDigest: target.digest, reason: "Major version mismatch" };
  if (tMinor >= sMinor) return { compatibility: "BACKWARD_COMPATIBLE", sourceOntologyDigest: source.digest, targetOntologyDigest: target.digest, reason: "Same major with target minor version not older" };
  return { compatibility: "UNKNOWN", sourceOntologyDigest: source.digest, targetOntologyDigest: target.digest, reason: "Target semantic version is older and requires explicit review" };
}

export function createEpistemicState(args: Omit<EpistemicState, "stateId" | "digest">, limits: KnowledgeSemanticLimits): EpistemicState {
  text("subject", args.subject); text("proposition", args.proposition); iso("observedAt", args.observedAt); bounded("confidence", args.confidence);
  if (args.sources.length > limits.maxEpistemicSources) throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED", "Epistemic source limit exceeded");
  const sources = clone(args.sources).map((x) => { text("sourceId", x.sourceId); text("sourceDigest", x.sourceDigest); iso("source.observedAt", x.observedAt); return { ...x, observedAt: new Date(x.observedAt).toISOString() }; });
  const identity = { subject: args.subject, proposition: args.proposition, status: args.status, confidence: args.confidence, sources, observedAt: new Date(args.observedAt).toISOString(), ...(args.derivedFrom === undefined ? {} : { derivedFrom: [...args.derivedFrom] }) };
  return { ...identity, stateId: digest(identity), digest: digest(identity) };
}

export class ProvenanceGraph {
  private readonly nodes = new Map<string, ProvenanceNode>();
  private readonly edges: ProvenanceEdge[] = [];
  constructor(private readonly limits: KnowledgeSemanticLimits) { positive("maxProvenanceNodes", limits.maxProvenanceNodes); positive("maxProvenanceEdges", limits.maxProvenanceEdges); }
  addNode(node: ProvenanceNode): void { if (this.nodes.size >= this.limits.maxProvenanceNodes) throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED", "Provenance node limit exceeded"); text("node.id", node.id); text("node.digest", node.digest); if (this.nodes.has(node.id)) throw new KnowledgeSemanticError("INVALID_SEMANTIC", "Duplicate provenance node"); this.nodes.set(node.id, clone(node)); }
  addEdge(edge: ProvenanceEdge): void {
    if (this.edges.length >= this.limits.maxProvenanceEdges) throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED", "Provenance edge limit exceeded");
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) throw new KnowledgeSemanticError("INVALID_SEMANTIC", "Provenance edge references unknown node");
    if (edge.from === edge.to || this.reachable(edge.to, edge.from)) throw new KnowledgeSemanticError("PROVENANCE_CYCLE", "Provenance graph must remain acyclic");
    this.edges.push(clone(edge));
  }
  snapshot(): ProvenanceGraphSnapshot { const nodes = [...this.nodes.values()].map(clone); const edges = this.edges.map(clone); return { nodes, edges, digest: digest({ nodes, edges }) }; }
  private reachable(start: string, target: string): boolean { const seen = new Set<string>(); const stack = [start]; while (stack.length) { const current = stack.pop()!; if (current === target) return true; if (seen.has(current)) continue; seen.add(current); for (const edge of this.edges) if (edge.from === current) stack.push(edge.to); } return false; }
}

export function makeSemanticReplayDescriptor(ontology: OntologyVersion, epistemic: EpistemicState, provenance: ProvenanceGraphSnapshot): SemanticReplayDescriptor {
  return { ontologyId: ontology.ontologyId, ontologyVersion: ontology.version, ontologyDigest: ontology.digest, epistemicDigest: epistemic.digest, provenanceDigest: provenance.digest, subject: epistemic.subject, proposition: epistemic.proposition };
}

export function verifySemanticReplayDescriptor(descriptor: SemanticReplayDescriptor, ontology: OntologyVersion, epistemic: EpistemicState, provenance: ProvenanceGraphSnapshot, limits: KnowledgeSemanticLimits): void {
  if (bytes(descriptor) > limits.maxReplayBytes) throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED", "Replay descriptor exceeds limit");
  if (descriptor.ontologyId !== ontology.ontologyId || descriptor.ontologyVersion !== ontology.version || descriptor.ontologyDigest !== ontology.digest) throw new KnowledgeSemanticError("REPLAY_MISMATCH", "Ontology identity mismatch");
  if (descriptor.epistemicDigest !== epistemic.digest || descriptor.provenanceDigest !== provenance.digest || descriptor.subject !== epistemic.subject || descriptor.proposition !== epistemic.proposition) throw new KnowledgeSemanticError("REPLAY_MISMATCH", "Semantic replay identity mismatch");
}

export class LegacyKnowledgeHandoff {
  constructor(private readonly limits: KnowledgeSemanticLimits) { positive("maxHandoffRecords", limits.maxHandoffRecords); }
  handoff(records: LegacyKnowledgeRecord[], mappings: LegacyKnowledgeMapping[]): KnowledgeHandoffResult {
    if (records.length > this.limits.maxHandoffRecords) throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED", "Legacy handoff record limit exceeded");
    const recordIds = new Set(records.map((x) => x.legacyId));
    const unmapped = records.filter((x) => !mappings.some((m) => m.legacyId === x.legacyId)).map((x) => x.legacyId);
    for (const mapping of mappings) { if (!recordIds.has(mapping.legacyId)) throw new KnowledgeSemanticError("HANDOFF_INCOMPLETE", "Mapping references unknown legacy record"); text("conceptId", mapping.conceptId); }
    const evidence = records.map((x) => ({ legacyId: x.legacyId, sourceSystem: x.sourceSystem, sourceDigest: x.sourceDigest })).sort((a, b) => a.legacyId.localeCompare(b.legacyId));
    const handoffId = digest({ evidence, mappings: clone(mappings), unmapped: [...unmapped].sort() });
    return { handoffId, accepted: unmapped.length === 0, preservedSourceDigest: digest(evidence), mappings: clone(mappings), unmapped: [...unmapped].sort(), evidenceDigest: digest({ evidence, mappings: clone(mappings) }) };
  }
}

export function semanticContextDigest(value: unknown, limits: KnowledgeSemanticLimits): string {
  if (bytes(value) > limits.maxSemanticContextBytes) throw new KnowledgeSemanticError("RESOURCE_EXHAUSTED", "Semantic context exceeds limit");
  return digest(value);
}
