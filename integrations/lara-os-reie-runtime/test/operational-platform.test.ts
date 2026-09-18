import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ReieWorkspace } from "../dist/workspace.js";
import { extractReieTextCandidates } from "../dist/extraction.js";
import { ReieReviewQueue } from "../dist/review.js";
import { ReieRelationGraph } from "../dist/relations.js";
import { deriveReiePriceHistory, deriveReiePriceChanges } from "../dist/price-history.js";
import {
  ReieAgentOrchestrator,
  createReieContentAgent,
  createReieQaAgent,
  createReieResearchAgent,
} from "../dist/agents.js";
import { ReieLocalServer } from "../dist/server.js";

const NOW = "2026-09-18T12:00:00.000Z";

test("OPS-001 text extraction is candidate-only and evidence-bearing", () => {
  const candidates = extractReieTextCandidates(
    "source-1",
    "property-1",
    "Price: 2500000 EGP",
    NOW,
    [{
      ruleId: "price-label",
      field: "price.amount",
      pattern: /Price:\s*([0-9]+)/u,
      valueType: "number",
    }],
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.value, 2500000);
  assert.equal(candidates[0]?.confidence, "REVIEW");
  assert.match(candidates[0]?.evidenceText ?? "", /Price/);
});

test("OPS-002 review acceptance creates a deterministic claim", async () => {
  const workspace = new ReieWorkspace();
  workspace.ingestSource({ sourceId: "s1", observedAt: NOW, contentDigest: "d1" });
  workspace.upsertEntity({
    entityId: "p1",
    entityType: "property",
    canonicalName: "P",
    location: "Sadat",
    aliases: [],
  });
  const candidate = extractReieTextCandidates(
    "s1",
    "p1",
    "Price: 100",
    NOW,
    [{
      ruleId: "price",
      field: "price.amount",
      pattern: /Price:\s*([0-9]+)/u,
      valueType: "number",
    }],
  )[0]!;
  const queue = new ReieReviewQueue();
  queue.add(candidate);
  const item = await queue.decide(candidate.candidateId, "ACCEPT", "reviewer-1", workspace, NOW);
  assert.equal(item.status, "ACCEPTED");
  assert.equal(workspace.getState().claims[0]?.value, 100);
  assert.equal(workspace.getState().claims[0]?.sourceId, "s1");
});

test("OPS-003 explicit relation graph is idempotent and queryable", () => {
  const graph = new ReieRelationGraph();
  const edge = graph.add({
    fromEntityId: "p1",
    toEntityId: "person1",
    relation: "listed_by",
    sourceIds: ["s1"],
    observedAt: NOW,
  });
  graph.add(edge);
  assert.equal(graph.listFor("p1").length, 1);
  assert.equal(graph.listFor("person1")[0]?.relation, "listed_by");
});

test("OPS-004 price history and change projection are deterministic", () => {
  const claims = [
    { claimId: "c2", entityId: "p1", sourceId: "s2", field: "price.amount", value: 110, observedAt: "2026-09-17T00:00:00Z" },
    { claimId: "c1", entityId: "p1", sourceId: "s1", field: "price.amount", value: 100, observedAt: "2026-09-10T00:00:00Z" },
  ];
  const history = deriveReiePriceHistory("p1", claims);
  const changes = deriveReiePriceChanges(history);
  assert.deepEqual(history.map((x) => x.claimId), ["c1", "c2"]);
  assert.equal(changes[0]?.percent, 10);
});

test("OPS-005 agent orchestration fails closed without governance", async () => {
  const workspace = new ReieWorkspace();
  const orchestrator = new ReieAgentOrchestrator();
  const result = await orchestrator.run([createReieQaAgent(), createReieResearchAgent()], {
    workspace,
    asOf: NOW,
    input: null,
  });
  assert.equal(result.every((x) => x.status === "FAILED"), true);
});

test("OPS-006 local HTTP API ingests, extracts, reviews, and queries on loopback", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reie-api-"));
  try {
    const server = new ReieLocalServer({ journalPath: join(dir, "events.jsonl"), port: 0 });
    const bound = await server.start();
    const base = `http://${bound.host}:${bound.port}`;

    const ingest = await fetch(base + "/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        document: {
          sourceId: "api-source",
          observedAt: NOW,
          mediaType: "application/json",
          content: JSON.stringify({
            records: [{
              entityId: "api-p1",
              entityType: "property",
              canonicalName: "API Property",
              location: "Sadat",
              claims: [{ field: "propertyType", value: "land" }],
            }],
          }),
        },
      }),
    });
    assert.equal(ingest.status, 200);

    const extraction = await fetch(base + "/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceId: "api-source",
        entityId: "api-p1",
        observedAt: NOW,
        content: "Price: 500",
        rules: [{
          ruleId: "price",
          field: "price.amount",
          pattern: "Price:\\s*([0-9]+)",
          flags: "",
          valueType: "number",
        }],
      }),
    });
    assert.equal(extraction.status, 200);
    const extractionBody = await extraction.json();
    const candidateId = extractionBody.candidates[0].candidateId;

    const review = await fetch(base + "/reviews/" + encodeURIComponent(candidateId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "ACCEPT", reviewer: "api-reviewer", reviewedAt: NOW }),
    });
    assert.equal(review.status, 200);

    const knowledge = await fetch(base + "/knowledge?q=API+Property+Sadat");
    assert.equal(knowledge.status, 200);
    const knowledgeBody = await knowledge.json();
    assert.deepEqual(knowledgeBody.entityIds, ["api-p1"]);

    await server.stop();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("OPS-007 default content agent emits only source-backed facts", async () => {
  const workspace = new ReieWorkspace();
  workspace.ingestSource({ sourceId: "s1", observedAt: NOW, contentDigest: "d" });
  workspace.upsertEntity({ entityId: "p1", entityType: "property", canonicalName: "P", aliases: [] });
  workspace.recordClaim({ claimId: "c1", entityId: "p1", sourceId: "s1", field: "location", value: "Sadat", observedAt: NOW });
  const result = await createReieContentAgent().run({ workspace, asOf: NOW, input: "p1" }) as { factualDraft: string; evidenceIds: string[] };
  assert.match(result.factualDraft, /location/);
  assert.deepEqual(result.evidenceIds, ["s1"]);
});
