import test from "node:test";
import assert from "node:assert/strict";
import {
  ReflexiveContinuityError,
  ReflexiveContinuityStore,
  appendContinuityLineage,
  buildContinuityLineage,
  createContinuityArchive,
  createContinuitySnapshot,
  createLineageNode,
  createPreservationManifest,
  createSelfImprovementProposal,
  createSuccessionCertificate,
  prepareImprovementCandidate,
  reconstructContinuity,
  reviewSelfImprovementProposal,
  selfModelDigest,
  verifyContinuityArchive,
  verifyContinuitySnapshot,
  verifyPreservationManifest,
  verifySelfModelContinuity,
  verifySuccessionCertificate,
  type ContinuitySnapshot,
  type ImprovementEvaluation,
  type ReflexiveContinuityLimits,
  type SelfImprovementProposal,
  type SelfModel,
  type TraceContext,
} from "../src/index.js";

const L: ReflexiveContinuityLimits = {
  maxLineageNodes: 20,
  maxParentsPerNode: 2,
  maxAncestryDepth: 10,
  maxEvidenceRefs: 8,
  maxArtifactDigests: 8,
  maxEventStreamHeads: 8,
  maxStateBytes: 3000,
  maxArchiveFiles: 10,
  maxChangeSetEntries: 8,
  maxProposalBytes: 7000,
  maxProposals: 4,
  maxCertificates: 4,
};

const MODEL: SelfModel = {
  identityId: "self-a",
  version: "1",
  capabilities: [{ capabilityId: "cap-a", name: "observe", version: "1", available: true, usable: true, verified: true, authorized: true, healthy: true }],
  declaredAuthorityScopes: ["read", "evaluate"],
  knownLimitations: ["no-external-side-effects"],
  updatedAt: "2026-09-17T17:00:00.000Z",
};

const BASE_ARGS = {
  identityId: "self-a",
  lineageNodeId: "node-a",
  generation: 0,
  state: { counter: 1, mode: "stable" },
  selfModel: MODEL,
  artifactDigests: ["artifact-a"],
  eventStreamHeads: ["stream-a"],
  semanticDigest: "semantic-a",
  policyDigest: "policy-a",
  evaluationDigest: "evaluation-a",
  authorityScopes: ["read", "evaluate"],
  capturedAt: "2026-09-17T17:00:00.000Z",
};

function baseSnapshot(): ContinuitySnapshot {
  return createContinuitySnapshot(BASE_ARGS, L);
}

function node(snapshot: ContinuitySnapshot, id = snapshot.lineageNodeId, parentIds: string[] = [], kind: "BIRTH" | "VERSION" | "FORK" | "MERGE" | "RECONSTRUCTION" | "SUCCESSOR" | "RETIREMENT" = "BIRTH") {
  return createLineageNode({ nodeId: id, identityId: snapshot.identityId, parentIds, kind, createdAt: snapshot.capturedAt, evidenceIds: ["evidence-a"], snapshotDigest: snapshot.snapshotDigest, authorityScopes: snapshot.authorityScopes }, L);
}

function proposalFor(snapshot: ContinuitySnapshot, targetState: unknown = { counter: 2, mode: "stable" }): SelfImprovementProposal {
  return createSelfImprovementProposal({
    proposalId: "proposal-a",
    baseSnapshot: snapshot,
    targetIdentityId: "self-a",
    targetState,
    changes: [{ path: "counter", beforeDigest: selfModelDigest(MODEL), afterDigest: "new-state" }],
    requiredEvaluationIds: ["eval-a"],
    proposedAuthorityScopes: ["read", "evaluate"],
    evidenceIds: ["proposal-evidence"],
    createdAt: "2026-09-17T17:01:00.000Z",
  }, L);
}

function evaluation(proposal: SelfImprovementProposal, status: ImprovementEvaluation["status"] = "PASS"): ImprovementEvaluation {
  return { evaluationId: "eval-a", proposalId: proposal.proposalId, status, evidenceIds: ["eval-evidence"], measuredDigest: "measured-a", completedAt: "2026-09-17T17:02:00.000Z" };
}

function throwsCode(fn: () => unknown, code: ReflexiveContinuityError["code"]): void {
  assert.throws(fn, (error: unknown) => error instanceof ReflexiveContinuityError && error.code === code);
}

test("F8-001 self-model digest is deterministic", () => {
  assert.equal(selfModelDigest(MODEL), selfModelDigest(structuredClone(MODEL)));
});
test("F8-002 self-model digest changes with identity", () => {
  assert.notEqual(selfModelDigest(MODEL), selfModelDigest({ ...MODEL, identityId: "self-b" }));
});
test("F8-003 self-model verification accepts matching capabilities", () => {
  verifySelfModelContinuity(MODEL, { verify: () => ({ ok: true, mismatches: [] }) });
});
test("F8-004 self-model verification fails closed", () => {
  throwsCode(() => verifySelfModelContinuity(MODEL, { verify: () => ({ ok: false, mismatches: ["healthy:cap-a"] }) }), "SELF_MODEL_MISMATCH");
});
test("F8-005 snapshot has deterministic state digest", () => {
  assert.equal(baseSnapshot().stateDigest, baseSnapshot().stateDigest);
});
test("F8-006 snapshot binds self-model digest", () => {
  assert.equal(baseSnapshot().selfModelDigest, selfModelDigest(MODEL));
});
test("F8-007 snapshot normalizes timestamp", () => {
  assert.equal(baseSnapshot().capturedAt, "2026-09-17T17:00:00.000Z");
});
test("F8-008 snapshot rejects empty identity", () => {
  throwsCode(() => createContinuitySnapshot({ ...BASE_ARGS, identityId: "" }, L), "INVALID_CONTINUITY");
});
test("F8-009 snapshot rejects invalid timestamp", () => {
  throwsCode(() => createContinuitySnapshot({ ...BASE_ARGS, capturedAt: "bad" }, L), "INVALID_CONTINUITY");
});
test("F8-010 snapshot rejects oversized state", () => {
  throwsCode(() => createContinuitySnapshot({ ...BASE_ARGS, state: "x".repeat(10000) }, L), "RESOURCE_EXHAUSTED");
});
test("F8-011 snapshot rejects too many artifacts", () => {
  throwsCode(() => createContinuitySnapshot({ ...BASE_ARGS, artifactDigests: Array.from({ length: 9 }, (_, i) => `a-${i}`) }, L), "RESOURCE_EXHAUSTED");
});
test("F8-012 snapshot rejects duplicate artifact digest", () => {
  throwsCode(() => createContinuitySnapshot({ ...BASE_ARGS, artifactDigests: ["a", "a"] }, L), "INVALID_CONTINUITY");
});
test("F8-013 snapshot returns caller-immutable state", () => {
  const source = { nested: { value: 1 } };
  const snapshot = createContinuitySnapshot({ ...BASE_ARGS, state: source }, L);
  source.nested.value = 9;
  assert.equal((snapshot.state as { nested: { value: number } }).nested.value, 1);
});
test("F8-014 snapshot verification accepts intact snapshot", () => {
  verifyContinuitySnapshot(baseSnapshot(), L);
});
test("F8-015 snapshot verification rejects tampered state", () => {
  const snapshot = baseSnapshot();
  throwsCode(() => verifyContinuitySnapshot({ ...snapshot, state: { counter: 999 }, snapshotDigest: snapshot.snapshotDigest }, L), "INVALID_CONTINUITY");
});
test("F8-016 lineage node validates parent count", () => {
  const snapshot = baseSnapshot();
  throwsCode(() => createLineageNode({ ...node(snapshot), parentIds: ["p1", "p2", "p3"] }, L), "RESOURCE_EXHAUSTED");
});
test("F8-017 lineage node rejects self-parent", () => {
  const snapshot = baseSnapshot();
  throwsCode(() => node(snapshot, "n1", ["n1"]), "LINEAGE_CYCLE");
});
test("F8-018 lineage graph rejects unknown parent", () => {
  const snapshot = baseSnapshot();
  throwsCode(() => buildContinuityLineage([node(snapshot, "n1", ["missing"])], L), "LINEAGE_MISMATCH");
});
test("F8-019 lineage graph is deterministically ordered", () => {
  const snapshot = baseSnapshot();
  const graph = buildContinuityLineage([node(snapshot, "b"), node(snapshot, "a")], L);
  assert.deepEqual(graph.nodes.map((x) => x.nodeId), ["a", "b"]);
});
test("F8-020 lineage graph detects cycles", () => {
  const snapshot = baseSnapshot();
  const a = node(snapshot, "a", ["b"]);
  const b = node(snapshot, "b", ["a"]);
  throwsCode(() => buildContinuityLineage([a, b], L), "LINEAGE_CYCLE");
});
test("F8-021 lineage graph enforces ancestry depth", () => {
  const tiny = { ...L, maxAncestryDepth: 1 };
  const snapshot = baseSnapshot();
  const a = node(snapshot, "a");
  const b = node(snapshot, "b", ["a"]);
  const c = node(snapshot, "c", ["b"]);
  throwsCode(() => buildContinuityLineage([a, b, c], tiny), "RESOURCE_EXHAUSTED");
});
test("F8-022 append lineage preserves existing nodes", () => {
  const snapshot = baseSnapshot();
  const a = node(snapshot, "a");
  const graph = buildContinuityLineage([a], L);
  const next = appendContinuityLineage(graph, node(snapshot, "b", ["a"], "VERSION"), L);
  assert.deepEqual(next.nodes.map((x) => x.nodeId), ["a", "b"]);
});
test("F8-023 append lineage rejects duplicate node", () => {
  const snapshot = baseSnapshot();
  const a = node(snapshot, "a");
  const graph = buildContinuityLineage([a], L);
  throwsCode(() => appendContinuityLineage(graph, a, L), "INVALID_CONTINUITY");
});
test("F8-024 lineage digest is stable after cloning", () => {
  const snapshot = baseSnapshot();
  const graph = buildContinuityLineage([node(snapshot, "a"), node(snapshot, "b", ["a"])], L);
  assert.equal(graph.digest, buildContinuityLineage(structuredClone(graph.nodes), L).digest);
});
test("F8-025 proposal binds base identity", () => {
  const proposal = proposalFor(baseSnapshot());
  assert.equal(proposal.baseIdentityId, "self-a");
});
test("F8-026 proposal binds base snapshot digest", () => {
  const snapshot = baseSnapshot();
  assert.equal(proposalFor(snapshot).baseSnapshotDigest, snapshot.snapshotDigest);
});
test("F8-027 proposal computes target state digest", () => {
  const proposal = proposalFor(baseSnapshot(), { counter: 7 });
  assert.notEqual(proposal.targetStateDigest, baseSnapshot().stateDigest);
});
test("F8-028 proposal rejects authority widening", () => {
  throwsCode(() => createSelfImprovementProposal({ ...proposalFor(baseSnapshot()), proposedAuthorityScopes: ["read", "evaluate", "admin"] }, L), "AUTHORITY_WIDENING");
});
test("F8-029 proposal rejects oversized target state", () => {
  throwsCode(() => proposalFor(baseSnapshot(), "x".repeat(10000)), "RESOURCE_EXHAUSTED");
});
test("F8-030 proposal is deterministic", () => {
  assert.equal(proposalFor(baseSnapshot()).proposalDigest, proposalFor(baseSnapshot()).proposalDigest);
});
test("F8-031 proposal preserves evidence refs", () => {
  assert.deepEqual(proposalFor(baseSnapshot()).evidenceIds, ["proposal-evidence"]);
});
test("F8-032 review approves passing required evaluation", () => {
  const proposal = proposalFor(baseSnapshot());
  const review = reviewSelfImprovementProposal({ proposal, evaluations: [evaluation(proposal)], reviewerId: "reviewer-a", evidenceIds: ["review-evidence"] });
  assert.equal(review.approved, true);
});
test("F8-033 review rejects failed required evaluation", () => {
  const proposal = proposalFor(baseSnapshot());
  const review = reviewSelfImprovementProposal({ proposal, evaluations: [evaluation(proposal, "FAIL")], reviewerId: "reviewer-a", evidenceIds: ["review-evidence"] });
  assert.equal(review.approved, false);
});
test("F8-034 review rejects wrong proposal evaluation", () => {
  const proposal = proposalFor(baseSnapshot());
  const review = reviewSelfImprovementProposal({ proposal, evaluations: [{ ...evaluation(proposal), proposalId: "other" }], reviewerId: "reviewer-a", evidenceIds: ["review-evidence"] });
  assert.equal(review.approved, false);
});
test("F8-035 review rejects missing required evaluation", () => {
  const proposal = proposalFor(baseSnapshot());
  const review = reviewSelfImprovementProposal({ proposal, evaluations: [], reviewerId: "reviewer-a", evidenceIds: ["review-evidence"] });
  assert.equal(review.approved, false);
});
test("F8-036 candidate requires matching base snapshot", () => {
  const proposal = proposalFor(baseSnapshot());
  const other = createContinuitySnapshot({ ...BASE_ARGS, state: { counter: 9 } }, L);
  const review = reviewSelfImprovementProposal({ proposal, evaluations: [evaluation(proposal)], reviewerId: "reviewer-a", evidenceIds: ["review-evidence"] });
  throwsCode(() => prepareImprovementCandidate({ proposal, baseSnapshot: other, review, lineageNodeId: "next", capturedAt: "2026-09-17T17:03:00.000Z" }, L), "IMPROVEMENT_REJECTED");
});
test("F8-037 candidate requires approved review", () => {
  const snapshot = baseSnapshot();
  const proposal = proposalFor(snapshot);
  const review = reviewSelfImprovementProposal({ proposal, evaluations: [evaluation(proposal, "FAIL")], reviewerId: "reviewer-a", evidenceIds: ["review-evidence"] });
  throwsCode(() => prepareImprovementCandidate({ proposal, baseSnapshot: snapshot, review, lineageNodeId: "next", capturedAt: "2026-09-17T17:03:00.000Z" }, L), "IMPROVEMENT_REJECTED");
});
test("F8-038 candidate preserves or narrows authority", () => {
  const snapshot = baseSnapshot();
  const proposal = createSelfImprovementProposal({ ...proposalFor(snapshot), proposedAuthorityScopes: ["read"] }, L);
  const review = reviewSelfImprovementProposal({ proposal, evaluations: [evaluation(proposal)], reviewerId: "reviewer-a", evidenceIds: ["review-evidence"] });
  const candidate = prepareImprovementCandidate({ proposal, baseSnapshot: snapshot, review, lineageNodeId: "next", capturedAt: "2026-09-17T17:03:00.000Z" }, L);
  assert.deepEqual(candidate.snapshot.authorityScopes, ["read"]);
});
test("F8-039 candidate increments generation", () => {
  const snapshot = baseSnapshot();
  const proposal = proposalFor(snapshot);
  const review = reviewSelfImprovementProposal({ proposal, evaluations: [evaluation(proposal)], reviewerId: "reviewer-a", evidenceIds: ["review-evidence"] });
  const candidate = prepareImprovementCandidate({ proposal, baseSnapshot: snapshot, review, lineageNodeId: "next", capturedAt: "2026-09-17T17:03:00.000Z" }, L);
  assert.equal(candidate.snapshot.generation, snapshot.generation + 1);
});
test("F8-040 candidate is explicitly non-widening", () => {
  const snapshot = baseSnapshot();
  const proposal = proposalFor(snapshot);
  const review = reviewSelfImprovementProposal({ proposal, evaluations: [evaluation(proposal)], reviewerId: "reviewer-a", evidenceIds: ["review-evidence"] });
  const candidate = prepareImprovementCandidate({ proposal, baseSnapshot: snapshot, review, lineageNodeId: "next", capturedAt: "2026-09-17T17:03:00.000Z" }, L);
  assert.equal(candidate.authorityWidened, false);
});
test("F8-041 succession requires distinct identity", () => {
  const predecessor = baseSnapshot();
  throwsCode(() => createSuccessionCertificate({ certificateId: "c1", predecessor, successor: { ...predecessor, generation: predecessor.generation + 1 }, acceptedBy: "acceptor", evidenceIds: ["succession-evidence"], createdAt: "2026-09-17T17:04:00.000Z" }, L), "SUCCESSION_INVALID");
});
test("F8-042 succession requires generation increment", () => {
  const predecessor = baseSnapshot();
  const successor = createContinuitySnapshot({ ...BASE_ARGS, identityId: "self-b" }, L);
  throwsCode(() => createSuccessionCertificate({ certificateId: "c1", predecessor, successor, acceptedBy: "acceptor", evidenceIds: ["succession-evidence"], createdAt: "2026-09-17T17:04:00.000Z" }, L), "SUCCESSION_INVALID");
});
test("F8-043 succession rejects widened authority", () => {
  const predecessor = baseSnapshot();
  const successor = createContinuitySnapshot({ ...BASE_ARGS, identityId: "self-b", generation: 1, authorityScopes: ["read", "evaluate", "admin"] }, L);
  throwsCode(() => createSuccessionCertificate({ certificateId: "c1", predecessor, successor, acceptedBy: "acceptor", evidenceIds: ["succession-evidence"], createdAt: "2026-09-17T17:04:00.000Z" }, L), "AUTHORITY_WIDENING");
});
test("F8-044 succession certificate is verifiable", () => {
  const predecessor = baseSnapshot();
  const successor = createContinuitySnapshot({ ...BASE_ARGS, identityId: "self-b", lineageNodeId: "node-b", generation: 1 }, L);
  const certificate = createSuccessionCertificate({ certificateId: "c1", predecessor, successor, acceptedBy: "acceptor", evidenceIds: ["succession-evidence"], createdAt: "2026-09-17T17:04:00.000Z" }, L);
  verifySuccessionCertificate(certificate, predecessor, successor);
});
test("F8-045 succession verification rejects tampering", () => {
  const predecessor = baseSnapshot();
  const successor = createContinuitySnapshot({ ...BASE_ARGS, identityId: "self-b", lineageNodeId: "node-b", generation: 1 }, L);
  const certificate = createSuccessionCertificate({ certificateId: "c1", predecessor, successor, acceptedBy: "acceptor", evidenceIds: ["succession-evidence"], createdAt: "2026-09-17T17:04:00.000Z" }, L);
  throwsCode(() => verifySuccessionCertificate({ ...certificate, successorIdentityId: "other" }, predecessor, successor), "SUCCESSION_INVALID");
});
test("F8-046 preservation manifest is deterministic", () => {
  const manifest = createPreservationManifest({ archiveId: "archive-a", identityId: "self-a", snapshotDigest: baseSnapshot().snapshotDigest, lineageDigest: "lineage-a", files: [{ path: "snapshot.json", digest: "file-a", bytes: 123 }], artifactDigests: ["artifact-a"], eventStreamHeads: ["stream-a"], formatVersion: "1", createdAt: "2026-09-17T17:05:00.000Z" }, L);
  assert.equal(manifest.manifestDigest, createPreservationManifest({ ...manifest, manifestDigest: undefined as never }, L).manifestDigest);
});
test("F8-047 preservation rejects duplicate paths", () => {
  throwsCode(() => createPreservationManifest({ archiveId: "archive-a", identityId: "self-a", snapshotDigest: "s", lineageDigest: "l", files: [{ path: "x", digest: "a", bytes: 1 }, { path: "x", digest: "b", bytes: 2 }], artifactDigests: [], eventStreamHeads: [], formatVersion: "1", createdAt: "2026-09-17T17:05:00.000Z" }, L), "INVALID_CONTINUITY");
});
test("F8-048 preservation verifies intact manifest", () => {
  const manifest = createPreservationManifest({ archiveId: "archive-a", identityId: "self-a", snapshotDigest: "s", lineageDigest: "l", files: [{ path: "x", digest: "a", bytes: 1 }], artifactDigests: [], eventStreamHeads: [], formatVersion: "1", createdAt: "2026-09-17T17:05:00.000Z" }, L);
  verifyPreservationManifest(manifest, L);
});
test("F8-049 preservation rejects tampered digest", () => {
  const manifest = createPreservationManifest({ archiveId: "archive-a", identityId: "self-a", snapshotDigest: "s", lineageDigest: "l", files: [{ path: "x", digest: "a", bytes: 1 }], artifactDigests: [], eventStreamHeads: [], formatVersion: "1", createdAt: "2026-09-17T17:05:00.000Z" }, L);
  throwsCode(() => verifyPreservationManifest({ ...manifest, lineageDigest: "changed" }, L), "PRESERVATION_MISMATCH");
});
test("F8-050 reconstruction accepts coherent package", () => {
  const snapshot = baseSnapshot();
  const graph = buildContinuityLineage([node(snapshot)], L);
  const preservation = createPreservationManifest({ archiveId: "archive-a", identityId: snapshot.identityId, snapshotDigest: snapshot.snapshotDigest, lineageDigest: graph.digest, files: [{ path: "snapshot.json", digest: "file-a", bytes: 1 }], artifactDigests: snapshot.artifactDigests, eventStreamHeads: snapshot.eventStreamHeads, formatVersion: "1", createdAt: snapshot.capturedAt }, L);
  const result = reconstructContinuity({ snapshot, lineage: graph, preservation, expectedIdentityId: snapshot.identityId, expectedLineageNodeId: snapshot.lineageNodeId }, L);
  assert.equal(result.verified, true);
});
test("F8-051 reconstruction reports identity mismatch", () => {
  const snapshot = baseSnapshot();
  const graph = buildContinuityLineage([node(snapshot)], L);
  const preservation = createPreservationManifest({ archiveId: "archive-a", identityId: snapshot.identityId, snapshotDigest: snapshot.snapshotDigest, lineageDigest: graph.digest, files: [], artifactDigests: snapshot.artifactDigests, eventStreamHeads: snapshot.eventStreamHeads, formatVersion: "1", createdAt: snapshot.capturedAt }, L);
  const result = reconstructContinuity({ snapshot, lineage: graph, preservation, expectedIdentityId: "other", expectedLineageNodeId: snapshot.lineageNodeId }, L);
  assert.equal(result.verified, false);
  assert.ok(result.mismatches.includes("identity"));
});
test("F8-052 reconstruction reports preservation mismatch", () => {
  const snapshot = baseSnapshot();
  const graph = buildContinuityLineage([node(snapshot)], L);
  const preservation = createPreservationManifest({ archiveId: "archive-a", identityId: snapshot.identityId, snapshotDigest: "wrong", lineageDigest: graph.digest, files: [], artifactDigests: [], eventStreamHeads: [], formatVersion: "1", createdAt: snapshot.capturedAt }, L);
  const result = reconstructContinuity({ snapshot, lineage: graph, preservation, expectedIdentityId: snapshot.identityId, expectedLineageNodeId: snapshot.lineageNodeId }, L);
  assert.equal(result.verified, false);
  assert.ok(result.mismatches.includes("preservation.snapshot"));
});
test("F8-053 continuity archive binds snapshot and lineage", () => {
  const snapshot = baseSnapshot();
  const graph = buildContinuityLineage([node(snapshot)], L);
  const preservation = createPreservationManifest({ archiveId: "archive-a", identityId: snapshot.identityId, snapshotDigest: snapshot.snapshotDigest, lineageDigest: graph.digest, files: [], artifactDigests: snapshot.artifactDigests, eventStreamHeads: snapshot.eventStreamHeads, formatVersion: "1", createdAt: snapshot.capturedAt }, L);
  const archive = createContinuityArchive({ archiveId: "archive-a", snapshot, lineage: graph, preservation });
  assert.equal(typeof archive.archiveDigest, "string");
});
test("F8-054 continuity archive verifies intact package", () => {
  const snapshot = baseSnapshot();
  const graph = buildContinuityLineage([node(snapshot)], L);
  const preservation = createPreservationManifest({ archiveId: "archive-a", identityId: snapshot.identityId, snapshotDigest: snapshot.snapshotDigest, lineageDigest: graph.digest, files: [], artifactDigests: snapshot.artifactDigests, eventStreamHeads: snapshot.eventStreamHeads, formatVersion: "1", createdAt: snapshot.capturedAt }, L);
  verifyContinuityArchive(createContinuityArchive({ archiveId: "archive-a", snapshot, lineage: graph, preservation }), L);
});
test("F8-055 continuity archive rejects tampered archive digest", () => {
  const snapshot = baseSnapshot();
  const graph = buildContinuityLineage([node(snapshot)], L);
  const preservation = createPreservationManifest({ archiveId: "archive-a", identityId: snapshot.identityId, snapshotDigest: snapshot.snapshotDigest, lineageDigest: graph.digest, files: [], artifactDigests: snapshot.artifactDigests, eventStreamHeads: snapshot.eventStreamHeads, formatVersion: "1", createdAt: snapshot.capturedAt }, L);
  const archive = createContinuityArchive({ archiveId: "archive-a", snapshot, lineage: graph, preservation });
  throwsCode(() => verifyContinuityArchive({ ...archive, archiveDigest: "wrong" }, L), "PRESERVATION_MISMATCH");
});
test("F8-056 store bounds proposals", () => {
  const store = new ReflexiveContinuityStore({ ...L, maxProposals: 1 });
  store.addProposal(proposalFor(baseSnapshot()));
  throwsCode(() => store.addProposal(createSelfImprovementProposal({ ...proposalFor(baseSnapshot()), proposalId: "proposal-b" }, L)), "RESOURCE_EXHAUSTED");
});
test("F8-057 store returns immutable proposal", () => {
  const store = new ReflexiveContinuityStore(L);
  const proposal = proposalFor(baseSnapshot());
  store.addProposal(proposal);
  const returned = store.getProposal(proposal.proposalId);
  returned.targetState = { changed: true };
  assert.notDeepEqual(store.getProposal(proposal.proposalId).targetState, { changed: true });
});
test("F8-058 store bounds certificates", () => {
  const store = new ReflexiveContinuityStore({ ...L, maxCertificates: 1 });
  const predecessor = baseSnapshot();
  const successor = createContinuitySnapshot({ ...BASE_ARGS, identityId: "self-b", lineageNodeId: "b", generation: 1 }, L);
  const certificate = createSuccessionCertificate({ certificateId: "c1", predecessor, successor, acceptedBy: "acceptor", evidenceIds: ["e"], createdAt: "2026-09-17T17:04:00.000Z" }, L);
  store.addSuccessionCertificate(certificate);
  throwsCode(() => store.addSuccessionCertificate({ ...certificate, certificateId: "c2" }), "RESOURCE_EXHAUSTED");
});
test("F8-059 store exposes bounded counts", () => {
  const store = new ReflexiveContinuityStore(L);
  assert.deepEqual(store.counts(), { proposals: 0, certificates: 0 });
});
test("F8-060 replay and preservation remain deterministic", () => {
  const snapshot = baseSnapshot();
  const graph = buildContinuityLineage([node(snapshot)], L);
  const preservation = createPreservationManifest({ archiveId: "archive-a", identityId: snapshot.identityId, snapshotDigest: snapshot.snapshotDigest, lineageDigest: graph.digest, files: [], artifactDigests: snapshot.artifactDigests, eventStreamHeads: snapshot.eventStreamHeads, formatVersion: "1", createdAt: snapshot.capturedAt }, L);
  const a = reconstructContinuity({ snapshot, lineage: graph, preservation, expectedIdentityId: snapshot.identityId, expectedLineageNodeId: snapshot.lineageNodeId }, L);
  const b = reconstructContinuity({ snapshot: structuredClone(snapshot), lineage: structuredClone(graph), preservation: structuredClone(preservation), expectedIdentityId: snapshot.identityId, expectedLineageNodeId: snapshot.lineageNodeId }, L);
  assert.equal(a.continuityDigest, b.continuityDigest);
});

void ({} as TraceContext);
