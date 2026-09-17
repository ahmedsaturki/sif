import { digest, stableStringify } from "./core.js";
import type { Capability } from "./types.js";
import type { SelfModel, SelfModelVerifier } from "./self-model.js";

export type ContinuityNodeKind = "BIRTH" | "VERSION" | "FORK" | "MERGE" | "RECONSTRUCTION" | "SUCCESSOR" | "RETIREMENT";
export type ImprovementEvaluationStatus = "PASS" | "FAIL" | "INDETERMINATE" | "UNAVAILABLE";

export interface ReflexiveContinuityLimits {
  maxLineageNodes: number;
  maxParentsPerNode: number;
  maxAncestryDepth: number;
  maxEvidenceRefs: number;
  maxArtifactDigests: number;
  maxEventStreamHeads: number;
  maxStateBytes: number;
  maxArchiveFiles: number;
  maxChangeSetEntries: number;
  maxProposalBytes: number;
  maxProposals: number;
  maxCertificates: number;
}

export interface ContinuitySnapshot {
  identityId: string;
  lineageNodeId: string;
  generation: number;
  state: unknown;
  stateDigest: string;
  selfModel: SelfModel;
  selfModelDigest: string;
  artifactDigests: string[];
  eventStreamHeads: string[];
  semanticDigest: string;
  policyDigest: string;
  evaluationDigest: string;
  authorityScopes: string[];
  capturedAt: string;
  snapshotDigest: string;
}

export interface ContinuityLineageNode {
  nodeId: string;
  identityId: string;
  parentIds: string[];
  kind: ContinuityNodeKind;
  createdAt: string;
  evidenceIds: string[];
  snapshotDigest: string;
  authorityScopes: string[];
}

export interface ContinuityLineageGraph {
  nodes: ContinuityLineageNode[];
  digest: string;
}

export interface SelfImprovementChange {
  path: string;
  beforeDigest: string;
  afterDigest: string;
}

export interface SelfImprovementProposal {
  proposalId: string;
  baseIdentityId: string;
  baseSnapshotDigest: string;
  targetIdentityId: string;
  targetState: unknown;
  targetStateDigest: string;
  changes: SelfImprovementChange[];
  requiredEvaluationIds: string[];
  proposedAuthorityScopes: string[];
  evidenceIds: string[];
  createdAt: string;
  proposalDigest: string;
}

export interface ImprovementEvaluation {
  evaluationId: string;
  proposalId: string;
  status: ImprovementEvaluationStatus;
  evidenceIds: string[];
  measuredDigest: string;
  completedAt: string;
}

export interface SelfImprovementReview {
  proposalId: string;
  baseSnapshotDigest: string;
  approved: boolean;
  evaluations: ImprovementEvaluation[];
  reviewerId: string;
  evidenceIds: string[];
  authorityWidened: false;
  reviewDigest: string;
}

export interface ImprovementCandidate {
  proposalId: string;
  snapshot: ContinuitySnapshot;
  authorityWidened: false;
  promotable: boolean;
  evidenceDigest: string;
}

export interface SuccessionCertificate {
  certificateId: string;
  predecessorIdentityId: string;
  successorIdentityId: string;
  predecessorSnapshotDigest: string;
  successorSnapshotDigest: string;
  predecessorAuthorityScopes: string[];
  successorAuthorityScopes: string[];
  authorityWidened: false;
  acceptedBy: string;
  evidenceIds: string[];
  createdAt: string;
  certificateDigest: string;
}

export interface PreservationFile {
  path: string;
  digest: string;
  bytes: number;
}

export interface PreservationManifest {
  archiveId: string;
  identityId: string;
  snapshotDigest: string;
  lineageDigest: string;
  files: PreservationFile[];
  artifactDigests: string[];
  eventStreamHeads: string[];
  formatVersion: string;
  createdAt: string;
  retentionUntil?: string;
  manifestDigest: string;
}

export interface ReconstructionInput {
  snapshot: ContinuitySnapshot;
  lineage: ContinuityLineageGraph;
  preservation: PreservationManifest;
  expectedIdentityId: string;
  expectedLineageNodeId: string;
}

export interface ReconstructionResult {
  verified: boolean;
  reconstructedSnapshotDigest: string;
  lineageDigest: string;
  preservationDigest: string;
  mismatches: string[];
  continuityDigest: string;
}

export interface ContinuityArchive {
  archiveId: string;
  snapshot: ContinuitySnapshot;
  lineage: ContinuityLineageGraph;
  preservation: PreservationManifest;
  archiveDigest: string;
}

export class ReflexiveContinuityError extends Error {
  constructor(readonly code:
    | "INVALID_CONTINUITY"
    | "RESOURCE_EXHAUSTED"
    | "LINEAGE_MISMATCH"
    | "LINEAGE_CYCLE"
    | "SELF_MODEL_MISMATCH"
    | "IMPROVEMENT_REJECTED"
    | "AUTHORITY_WIDENING"
    | "SUCCESSION_INVALID"
    | "PRESERVATION_MISMATCH"
    | "RECONSTRUCTION_FAILED"
  , message: string) {
    super(message);
    this.name = "ReflexiveContinuityError";
  }
}

function text(name: string, value: string): void {
  if (value.length === 0) throw new ReflexiveContinuityError("INVALID_CONTINUITY", `${name} must not be empty`);
}
function positive(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", `${name} must be positive`);
}
function nonNegativeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new ReflexiveContinuityError("INVALID_CONTINUITY", `${name} must be a non-negative integer`);
}
function iso(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new ReflexiveContinuityError("INVALID_CONTINUITY", `${name} must be a valid ISO timestamp`);
}
function finiteBytes(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new ReflexiveContinuityError("INVALID_CONTINUITY", `${name} must be a non-negative safe integer`);
}
function bytes(value: unknown): number {
  return new TextEncoder().encode(stableStringify(value)).byteLength;
}
function clone<T>(value: T): T {
  return structuredClone(value);
}
function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new ReflexiveContinuityError("INVALID_CONTINUITY", `${label} identifiers must be unique`);
}
function subset(required: string[], available: string[]): boolean {
  const set = new Set(available);
  return required.every((scope) => set.has(scope));
}
function validateLimits(limits: ReflexiveContinuityLimits): void {
  for (const [key, value] of Object.entries(limits)) positive(key, value as number);
}
function validateEvidence(ids: string[], limits: Pick<ReflexiveContinuityLimits, "maxEvidenceRefs">): void {
  if (ids.length > limits.maxEvidenceRefs) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Evidence reference limit exceeded");
  for (const id of ids) text("evidenceId", id);
  unique(ids, "evidence");
}
function validateCapabilities(capabilities: Capability[]): void {
  const ids = capabilities.map((x) => x.capabilityId);
  unique(ids, "capability");
  for (const capability of capabilities) text("capabilityId", capability.capabilityId);
}

export function selfModelDigest(model: SelfModel): string {
  text("identityId", model.identityId);
  text("version", model.version);
  iso("updatedAt", model.updatedAt);
  validateCapabilities(model.capabilities);
  const normalized = {
    identityId: model.identityId,
    version: model.version,
    capabilities: clone(model.capabilities),
    declaredAuthorityScopes: [...model.declaredAuthorityScopes].sort(),
    knownLimitations: [...model.knownLimitations].sort(),
    updatedAt: new Date(model.updatedAt).toISOString(),
  };
  return digest(normalized);
}

export function verifySelfModelContinuity(model: SelfModel, verifier: SelfModelVerifier): void {
  const result = verifier.verify(clone(model));
  if (!result.ok) throw new ReflexiveContinuityError("SELF_MODEL_MISMATCH", result.mismatches.join(","));
}

export function createContinuitySnapshot(args: {
  identityId: string;
  lineageNodeId: string;
  generation: number;
  state: unknown;
  selfModel: SelfModel;
  artifactDigests: string[];
  eventStreamHeads: string[];
  semanticDigest: string;
  policyDigest: string;
  evaluationDigest: string;
  authorityScopes: string[];
  capturedAt: string;
}, limits: ReflexiveContinuityLimits): ContinuitySnapshot {
  validateLimits(limits);
  text("identityId", args.identityId);
  text("lineageNodeId", args.lineageNodeId);
  nonNegativeInteger("generation", args.generation);
  iso("capturedAt", args.capturedAt);
  text("semanticDigest", args.semanticDigest);
  text("policyDigest", args.policyDigest);
  text("evaluationDigest", args.evaluationDigest);
  if (args.artifactDigests.length > limits.maxArtifactDigests) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Artifact digest limit exceeded");
  if (args.eventStreamHeads.length > limits.maxEventStreamHeads) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Event-stream head limit exceeded");
  unique(args.artifactDigests, "artifact");
  unique(args.eventStreamHeads, "event stream");
  if (bytes(args.state) > limits.maxStateBytes) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Continuity state exceeds byte limit");
  validateCapabilities(args.selfModel.capabilities);
  const smDigest = selfModelDigest(args.selfModel);
  const normalized = {
    identityId: args.identityId,
    lineageNodeId: args.lineageNodeId,
    generation: args.generation,
    state: clone(args.state),
    selfModel: clone(args.selfModel),
    artifactDigests: [...args.artifactDigests],
    eventStreamHeads: [...args.eventStreamHeads],
    semanticDigest: args.semanticDigest,
    policyDigest: args.policyDigest,
    evaluationDigest: args.evaluationDigest,
    authorityScopes: [...args.authorityScopes].sort(),
    capturedAt: new Date(args.capturedAt).toISOString(),
  };
  const stateDigest = digest(normalized.state);
  const snapshotDigest = digest({ ...normalized, stateDigest, selfModelDigest: smDigest });
  return {
    ...normalized,
    stateDigest,
    selfModelDigest: smDigest,
    artifactDigests: [...args.artifactDigests],
    eventStreamHeads: [...args.eventStreamHeads],
    authorityScopes: [...args.authorityScopes],
    capturedAt: new Date(args.capturedAt).toISOString(),
    snapshotDigest,
  };
}

export function verifyContinuitySnapshot(snapshot: ContinuitySnapshot, limits: ReflexiveContinuityLimits): void {
  const rebuilt = createContinuitySnapshot({
    identityId: snapshot.identityId,
    lineageNodeId: snapshot.lineageNodeId,
    generation: snapshot.generation,
    state: snapshot.state,
    selfModel: snapshot.selfModel,
    artifactDigests: snapshot.artifactDigests,
    eventStreamHeads: snapshot.eventStreamHeads,
    semanticDigest: snapshot.semanticDigest,
    policyDigest: snapshot.policyDigest,
    evaluationDigest: snapshot.evaluationDigest,
    authorityScopes: snapshot.authorityScopes,
    capturedAt: snapshot.capturedAt,
  }, limits);
  if (rebuilt.stateDigest !== snapshot.stateDigest || rebuilt.selfModelDigest !== snapshot.selfModelDigest || rebuilt.snapshotDigest !== snapshot.snapshotDigest) {
    throw new ReflexiveContinuityError("INVALID_CONTINUITY", "Continuity snapshot digest verification failed");
  }
}

export function createLineageNode(args: {
  nodeId: string;
  identityId: string;
  parentIds: string[];
  kind: ContinuityNodeKind;
  createdAt: string;
  evidenceIds: string[];
  snapshotDigest: string;
  authorityScopes: string[];
}, limits: ReflexiveContinuityLimits): ContinuityLineageNode {
  validateLimits(limits);
  text("nodeId", args.nodeId);
  text("identityId", args.identityId);
  iso("createdAt", args.createdAt);
  if (args.parentIds.length > limits.maxParentsPerNode) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Parent limit exceeded");
  if (args.parentIds.includes(args.nodeId)) throw new ReflexiveContinuityError("LINEAGE_CYCLE", "Lineage node cannot parent itself");
  unique(args.parentIds, "parent");
  text("snapshotDigest", args.snapshotDigest);
  validateEvidence(args.evidenceIds, limits);
  return {
    nodeId: args.nodeId,
    identityId: args.identityId,
    parentIds: [...args.parentIds],
    kind: args.kind,
    createdAt: new Date(args.createdAt).toISOString(),
    evidenceIds: [...args.evidenceIds],
    snapshotDigest: args.snapshotDigest,
    authorityScopes: [...args.authorityScopes],
  };
}

export function buildContinuityLineage(nodes: ContinuityLineageNode[], limits: ReflexiveContinuityLimits): ContinuityLineageGraph {
  validateLimits(limits);
  if (nodes.length > limits.maxLineageNodes) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Lineage node limit exceeded");
  unique(nodes.map((x) => x.nodeId), "lineage node");
  const map = new Map(nodes.map((node) => [node.nodeId, node]));
  for (const node of nodes) {
    if (node.parentIds.length > limits.maxParentsPerNode) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Parent limit exceeded");
    for (const parent of node.parentIds) if (!map.has(parent)) throw new ReflexiveContinuityError("LINEAGE_MISMATCH", `Unknown lineage parent ${parent}`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (id: string, depth: number): void => {
    if (depth > limits.maxAncestryDepth) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Lineage ancestry depth exceeded");
    if (visiting.has(id)) throw new ReflexiveContinuityError("LINEAGE_CYCLE", "Lineage cycle detected");
    if (visited.has(id)) return;
    visiting.add(id);
    const current = map.get(id);
    if (current === undefined) throw new ReflexiveContinuityError("LINEAGE_MISMATCH", `Unknown lineage node ${id}`);
    for (const parent of current.parentIds) walk(parent, depth + 1);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of nodes) walk(node.nodeId, 0);
  const ordered = [...nodes].map(clone).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  return { nodes: ordered, digest: digest(ordered) };
}

export function appendContinuityLineage(graph: ContinuityLineageGraph, node: ContinuityLineageNode, limits: ReflexiveContinuityLimits): ContinuityLineageGraph {
  if (graph.nodes.length >= limits.maxLineageNodes) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Lineage node limit exceeded");
  if (graph.nodes.some((x) => x.nodeId === node.nodeId)) throw new ReflexiveContinuityError("INVALID_CONTINUITY", "Lineage node already exists");
  return buildContinuityLineage([...graph.nodes, clone(node)], limits);
}

export function createSelfImprovementProposal(args: {
  proposalId: string;
  baseSnapshot: ContinuitySnapshot;
  targetIdentityId: string;
  targetState: unknown;
  changes: SelfImprovementChange[];
  requiredEvaluationIds: string[];
  proposedAuthorityScopes: string[];
  evidenceIds: string[];
  createdAt: string;
}, limits: ReflexiveContinuityLimits): SelfImprovementProposal {
  validateLimits(limits);
  text("proposalId", args.proposalId);
  text("targetIdentityId", args.targetIdentityId);
  iso("createdAt", args.createdAt);
  if (args.changes.length > limits.maxChangeSetEntries) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Improvement change-set limit exceeded");
  if (args.requiredEvaluationIds.length === 0 || args.requiredEvaluationIds.length > limits.maxChangeSetEntries) throw new ReflexiveContinuityError("IMPROVEMENT_REJECTED", "At least one bounded evaluation is required for self-improvement");
  unique(args.requiredEvaluationIds, "evaluation");
  if (args.changes.some((change) => change.path.length === 0 || change.beforeDigest.length === 0 || change.afterDigest.length === 0)) throw new ReflexiveContinuityError("INVALID_CONTINUITY", "Improvement changes require explicit path and digest identities");
  validateEvidence(args.evidenceIds, limits);
  if (args.evidenceIds.length === 0) throw new ReflexiveContinuityError("IMPROVEMENT_REJECTED", "Self-improvement requires evidence");
  if (bytes(args.targetState) > limits.maxStateBytes) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Improvement target state exceeds byte limit");
  if (!subset(args.proposedAuthorityScopes, args.baseSnapshot.authorityScopes)) throw new ReflexiveContinuityError("AUTHORITY_WIDENING", "Improvement cannot widen authority scopes");
  const targetStateDigest = digest(args.targetState);
  const base = {
    proposalId: args.proposalId,
    baseIdentityId: args.baseSnapshot.identityId,
    baseSnapshotDigest: args.baseSnapshot.snapshotDigest,
    targetIdentityId: args.targetIdentityId,
    targetState: clone(args.targetState),
    targetStateDigest,
    changes: clone(args.changes),
    requiredEvaluationIds: [...args.requiredEvaluationIds],
    proposedAuthorityScopes: [...args.proposedAuthorityScopes],
    evidenceIds: [...args.evidenceIds],
    createdAt: new Date(args.createdAt).toISOString(),
  };
  if (bytes(base) > limits.maxProposalBytes) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Improvement proposal exceeds byte limit");
  return { ...base, proposalDigest: digest(base) };
}

export function reviewSelfImprovementProposal(args: {
  proposal: SelfImprovementProposal;
  evaluations: ImprovementEvaluation[];
  reviewerId: string;
  evidenceIds: string[];
}): SelfImprovementReview {
  text("reviewerId", args.reviewerId);
  if (args.evidenceIds.length === 0) throw new ReflexiveContinuityError("IMPROVEMENT_REJECTED", "Review requires evidence");
  validateEvidence(args.evidenceIds, { maxEvidenceRefs: Number.MAX_SAFE_INTEGER });
  const byId = new Map(args.evaluations.map((evaluation) => [evaluation.evaluationId, evaluation]));
  const required = args.proposal.requiredEvaluationIds.map((id) => byId.get(id));
  const approved = required.every((evaluation) => evaluation !== undefined && evaluation.proposalId === args.proposal.proposalId && evaluation.status === "PASS");
  const reviewBase = {
    proposalId: args.proposal.proposalId,
    baseSnapshotDigest: args.proposal.baseSnapshotDigest,
    approved,
    evaluations: clone(args.evaluations),
    reviewerId: args.reviewerId,
    evidenceIds: [...args.evidenceIds],
    authorityWidened: false as const,
  };
  return { ...reviewBase, reviewDigest: digest(reviewBase) };
}

export function prepareImprovementCandidate(args: {
  proposal: SelfImprovementProposal;
  baseSnapshot: ContinuitySnapshot;
  review: SelfImprovementReview;
  lineageNodeId: string;
  capturedAt: string;
}, limits: ReflexiveContinuityLimits): ImprovementCandidate {
  if (args.proposal.baseSnapshotDigest !== args.baseSnapshot.snapshotDigest) throw new ReflexiveContinuityError("IMPROVEMENT_REJECTED", "Improvement base snapshot mismatch");
  if (args.review.proposalId !== args.proposal.proposalId || args.review.baseSnapshotDigest !== args.baseSnapshot.snapshotDigest || !args.review.approved || args.review.authorityWidened) {
    throw new ReflexiveContinuityError("IMPROVEMENT_REJECTED", "Improvement review did not establish a promotion-ready candidate");
  }
  if (!subset(args.proposal.proposedAuthorityScopes, args.baseSnapshot.authorityScopes)) throw new ReflexiveContinuityError("AUTHORITY_WIDENING", "Improvement would widen authority");
  const snapshot = createContinuitySnapshot({
    identityId: args.proposal.targetIdentityId,
    lineageNodeId: args.lineageNodeId,
    generation: args.baseSnapshot.generation + 1,
    state: args.proposal.targetState,
    selfModel: args.baseSnapshot.selfModel,
    artifactDigests: args.baseSnapshot.artifactDigests,
    eventStreamHeads: args.baseSnapshot.eventStreamHeads,
    semanticDigest: args.baseSnapshot.semanticDigest,
    policyDigest: args.baseSnapshot.policyDigest,
    evaluationDigest: args.baseSnapshot.evaluationDigest,
    authorityScopes: args.proposal.proposedAuthorityScopes,
    capturedAt: args.capturedAt,
  }, limits);
  return { proposalId: args.proposal.proposalId, snapshot, authorityWidened: false, promotable: true, evidenceDigest: digest({ proposal: args.proposal.proposalDigest, review: args.review.reviewDigest, snapshot: snapshot.snapshotDigest }) };
}

export function createSuccessionCertificate(args: {
  certificateId: string;
  predecessor: ContinuitySnapshot;
  successor: ContinuitySnapshot;
  acceptedBy: string;
  evidenceIds: string[];
  createdAt: string;
}, limits: ReflexiveContinuityLimits): SuccessionCertificate {
  validateLimits(limits);
  text("certificateId", args.certificateId);
  text("acceptedBy", args.acceptedBy);
  iso("createdAt", args.createdAt);
  if (args.predecessor.identityId === args.successor.identityId) throw new ReflexiveContinuityError("SUCCESSION_INVALID", "Successor must have a distinct identity id");
  if (args.successor.generation !== args.predecessor.generation + 1) throw new ReflexiveContinuityError("SUCCESSION_INVALID", "Successor generation must increment exactly once");
  if (!subset(args.successor.authorityScopes, args.predecessor.authorityScopes)) throw new ReflexiveContinuityError("AUTHORITY_WIDENING", "Succession cannot widen authority scopes");
  validateEvidence(args.evidenceIds, limits);
  if (args.evidenceIds.length === 0) throw new ReflexiveContinuityError("SUCCESSION_INVALID", "Succession requires evidence");
  const base = {
    certificateId: args.certificateId,
    predecessorIdentityId: args.predecessor.identityId,
    successorIdentityId: args.successor.identityId,
    predecessorSnapshotDigest: args.predecessor.snapshotDigest,
    successorSnapshotDigest: args.successor.snapshotDigest,
    predecessorAuthorityScopes: [...args.predecessor.authorityScopes],
    successorAuthorityScopes: [...args.successor.authorityScopes],
    authorityWidened: false as const,
    acceptedBy: args.acceptedBy,
    evidenceIds: [...args.evidenceIds],
    createdAt: new Date(args.createdAt).toISOString(),
  };
  return { ...base, certificateDigest: digest(base) };
}

export function verifySuccessionCertificate(certificate: SuccessionCertificate, predecessor: ContinuitySnapshot, successor: ContinuitySnapshot): void {
  if (certificate.predecessorSnapshotDigest !== predecessor.snapshotDigest || certificate.successorSnapshotDigest !== successor.snapshotDigest || certificate.predecessorIdentityId !== predecessor.identityId || certificate.successorIdentityId !== successor.identityId || certificate.authorityWidened || !subset(certificate.successorAuthorityScopes, certificate.predecessorAuthorityScopes)) {
    throw new ReflexiveContinuityError("SUCCESSION_INVALID", "Succession certificate does not match snapshots");
  }
  const { certificateDigest: _ignored, ...base } = certificate;
  if (digest(base) !== certificate.certificateDigest) throw new ReflexiveContinuityError("SUCCESSION_INVALID", "Succession certificate digest mismatch");
}

export function createPreservationManifest(args: {
  archiveId: string;
  identityId: string;
  snapshotDigest: string;
  lineageDigest: string;
  files: PreservationFile[];
  artifactDigests: string[];
  eventStreamHeads: string[];
  formatVersion: string;
  createdAt: string;
  retentionUntil?: string;
}, limits: ReflexiveContinuityLimits): PreservationManifest {
  validateLimits(limits);
  text("archiveId", args.archiveId);
  text("identityId", args.identityId);
  text("snapshotDigest", args.snapshotDigest);
  text("lineageDigest", args.lineageDigest);
  text("formatVersion", args.formatVersion);
  iso("createdAt", args.createdAt);
  if (args.retentionUntil !== undefined) iso("retentionUntil", args.retentionUntil);
  if (args.retentionUntil !== undefined && Date.parse(args.retentionUntil) < Date.parse(args.createdAt)) throw new ReflexiveContinuityError("INVALID_CONTINUITY", "Retention cannot end before preservation creation");
  if (args.files.length > limits.maxArchiveFiles) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Preservation file limit exceeded");
  if (args.artifactDigests.length > limits.maxArtifactDigests) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Artifact digest limit exceeded");
  if (args.eventStreamHeads.length > limits.maxEventStreamHeads) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Event-stream head limit exceeded");
  unique(args.files.map((file) => file.path), "preservation path");
  unique(args.artifactDigests, "artifact");
  unique(args.eventStreamHeads, "event stream");
  for (const file of args.files) {
    text("file.path", file.path);
    text("file.digest", file.digest);
    finiteBytes("file.bytes", file.bytes);
  }
  const base = {
    archiveId: args.archiveId,
    identityId: args.identityId,
    snapshotDigest: args.snapshotDigest,
    lineageDigest: args.lineageDigest,
    files: clone(args.files),
    artifactDigests: [...args.artifactDigests],
    eventStreamHeads: [...args.eventStreamHeads],
    formatVersion: args.formatVersion,
    createdAt: new Date(args.createdAt).toISOString(),
    ...(args.retentionUntil === undefined ? {} : { retentionUntil: new Date(args.retentionUntil).toISOString() }),
  };
  return { ...base, manifestDigest: digest(base) };
}

export function verifyPreservationManifest(manifest: PreservationManifest, limits: ReflexiveContinuityLimits): void {
  const rebuilt = createPreservationManifest({
    archiveId: manifest.archiveId,
    identityId: manifest.identityId,
    snapshotDigest: manifest.snapshotDigest,
    lineageDigest: manifest.lineageDigest,
    files: manifest.files,
    artifactDigests: manifest.artifactDigests,
    eventStreamHeads: manifest.eventStreamHeads,
    formatVersion: manifest.formatVersion,
    createdAt: manifest.createdAt,
    ...(manifest.retentionUntil === undefined ? {} : { retentionUntil: manifest.retentionUntil }),
  }, limits);
  if (rebuilt.manifestDigest !== manifest.manifestDigest) throw new ReflexiveContinuityError("PRESERVATION_MISMATCH", "Preservation manifest digest mismatch");
}

export function reconstructContinuity(input: ReconstructionInput, limits: ReflexiveContinuityLimits): ReconstructionResult {
  const mismatches: string[] = [];
  try { verifyContinuitySnapshot(input.snapshot, limits); } catch (error) { mismatches.push(`snapshot:${String(error)}`); }
  try { verifyPreservationManifest(input.preservation, limits); } catch (error) { mismatches.push(`preservation:${String(error)}`); }
  try {
    const rebuiltLineage = buildContinuityLineage(input.lineage.nodes, limits);
    if (rebuiltLineage.digest !== input.lineage.digest) mismatches.push("lineage.digest");
  } catch (error) {
    mismatches.push(`lineage:${String(error)}`);
  }
  if (input.snapshot.identityId !== input.expectedIdentityId) mismatches.push("identity");
  if (input.snapshot.lineageNodeId !== input.expectedLineageNodeId) mismatches.push("lineageNode");
  if (input.preservation.identityId !== input.snapshot.identityId) mismatches.push("preservation.identity");
  if (input.preservation.snapshotDigest !== input.snapshot.snapshotDigest) mismatches.push("preservation.snapshot");
  if (input.preservation.lineageDigest !== input.lineage.digest) mismatches.push("preservation.lineage");
  const continuityDigest = digest({ snapshot: input.snapshot.snapshotDigest, lineage: input.lineage.digest, preservation: input.preservation.manifestDigest, mismatches: [...mismatches] });
  return {
    verified: mismatches.length === 0,
    reconstructedSnapshotDigest: input.snapshot.snapshotDigest,
    lineageDigest: input.lineage.digest,
    preservationDigest: input.preservation.manifestDigest,
    mismatches,
    continuityDigest,
  };
}

export function createContinuityArchive(args: {
  archiveId: string;
  snapshot: ContinuitySnapshot;
  lineage: ContinuityLineageGraph;
  preservation: PreservationManifest;
}): ContinuityArchive {
  text("archiveId", args.archiveId);
  if (args.preservation.identityId !== args.snapshot.identityId || args.preservation.snapshotDigest !== args.snapshot.snapshotDigest || args.preservation.lineageDigest !== args.lineage.digest || !args.lineage.nodes.some((node) => node.nodeId === args.snapshot.lineageNodeId && node.snapshotDigest === args.snapshot.snapshotDigest)) {
    throw new ReflexiveContinuityError("PRESERVATION_MISMATCH", "Archive components are not mutually bound");
  }
  const base = { archiveId: args.archiveId, snapshot: clone(args.snapshot), lineage: clone(args.lineage), preservation: clone(args.preservation) };
  return { ...base, archiveDigest: digest({ archiveId: base.archiveId, snapshot: base.snapshot.snapshotDigest, lineage: base.lineage.digest, preservation: base.preservation.manifestDigest }) };
}

export function verifyContinuityArchive(archive: ContinuityArchive, limits: ReflexiveContinuityLimits): void {
  verifyContinuitySnapshot(archive.snapshot, limits);
  const lineage = buildContinuityLineage(archive.lineage.nodes, limits);
  verifyPreservationManifest(archive.preservation, limits);
  if (archive.preservation.identityId !== archive.snapshot.identityId || archive.preservation.snapshotDigest !== archive.snapshot.snapshotDigest || archive.preservation.lineageDigest !== lineage.digest || !lineage.nodes.some((node) => node.nodeId === archive.snapshot.lineageNodeId && node.snapshotDigest === archive.snapshot.snapshotDigest)) {
    throw new ReflexiveContinuityError("PRESERVATION_MISMATCH", "Continuity archive component binding failed");
  }
  const expected = digest({ archiveId: archive.archiveId, snapshot: archive.snapshot.snapshotDigest, lineage: archive.lineage.digest, preservation: archive.preservation.manifestDigest });
  if (expected !== archive.archiveDigest) throw new ReflexiveContinuityError("PRESERVATION_MISMATCH", "Continuity archive digest mismatch");
}

export class ReflexiveContinuityStore {
  private readonly proposals = new Map<string, SelfImprovementProposal>();
  private readonly certificates = new Map<string, SuccessionCertificate>();
  constructor(private readonly limits: ReflexiveContinuityLimits) { validateLimits(limits); }
  addProposal(proposal: SelfImprovementProposal): void {
    if (this.proposals.size >= this.limits.maxProposals && !this.proposals.has(proposal.proposalId)) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Proposal store limit exceeded");
    if (this.proposals.has(proposal.proposalId)) throw new ReflexiveContinuityError("INVALID_CONTINUITY", "Proposal already exists");
    this.proposals.set(proposal.proposalId, clone(proposal));
  }
  getProposal(proposalId: string): SelfImprovementProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new ReflexiveContinuityError("INVALID_CONTINUITY", "Unknown proposal");
    return clone(proposal);
  }
  addSuccessionCertificate(certificate: SuccessionCertificate): void {
    if (this.certificates.size >= this.limits.maxCertificates && !this.certificates.has(certificate.certificateId)) throw new ReflexiveContinuityError("RESOURCE_EXHAUSTED", "Certificate store limit exceeded");
    if (this.certificates.has(certificate.certificateId)) throw new ReflexiveContinuityError("INVALID_CONTINUITY", "Certificate already exists");
    this.certificates.set(certificate.certificateId, clone(certificate));
  }
  getSuccessionCertificate(certificateId: string): SuccessionCertificate {
    const certificate = this.certificates.get(certificateId);
    if (!certificate) throw new ReflexiveContinuityError("INVALID_CONTINUITY", "Unknown succession certificate");
    return clone(certificate);
  }
  counts(): { proposals: number; certificates: number } {
    return { proposals: this.proposals.size, certificates: this.certificates.size };
  }
}
