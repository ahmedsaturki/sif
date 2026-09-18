import test from "node:test";
import assert from "node:assert/strict";
import { ReieWorkspace } from "../dist/workspace.js";
import { canonicalIngestionRecord, ingestReieDocument } from "../dist/ingestion.js";
import { deriveReieOpportunities } from "../dist/opportunity.js";

const NOW = "2026-09-18T00:00:00.000Z";

test("REIE-ING001 ingests explicit JSON records without inference", async () => {
  const workspace = new ReieWorkspace();
  const result = await ingestReieDocument(workspace, {
    sourceId: "src-1",
    observedAt: NOW,
    mediaType: "application/json",
    content: JSON.stringify({
      records: [{
        entityId: "p1",
        entityType: "property",
        canonicalName: "Galaxy Mall",
        location: "Sadat City",
        aliases: ["Galaxy"],
        claims: [
          { field: "price.amount", value: 2500000 },
          { field: "propertyType", value: "mall" }
        ]
      }]
    })
  });

  assert.equal(result.recordsAccepted, 1);
  assert.equal(result.entityIds[0], "p1");
  assert.equal(workspace.getState().claims.length, 2);
  assert.deepEqual(workspace.knowledge("Galaxy Sadat"), {
    query: "galaxy sadat",
    entityIds: ["p1"],
    claimIds: [
      result.claimIds[0]!,
      result.claimIds[1]!,
    ].sort(),
    sourceIds: ["src-1"],
  });
});

test("REIE-ING002 text sources are preserved but not semantically guessed", async () => {
  const workspace = new ReieWorkspace();
  const result = await ingestReieDocument(workspace, {
    sourceId: "plain-1",
    observedAt: NOW,
    mediaType: "text/plain",
    content: "Galaxy Mall, Sadat City, 2.5M"
  });
  assert.equal(result.recordsAccepted, 0);
  assert.equal(workspace.getState().sources.length, 1);
  assert.equal(workspace.getState().entities.length, 0);
});

test("REIE-ING003 CSV requires explicit mapping", async () => {
  const workspace = new ReieWorkspace();
  await assert.rejects(
    () => ingestReieDocument(workspace, {
      sourceId: "csv-1",
      observedAt: NOW,
      mediaType: "text/csv",
      content: "name,type,location\nGalaxy Mall,mall,Sadat City\n"
    }),
    /explicit column mapping/
  );
});

test("REIE-ING004 CSV mapping produces deterministic claims", async () => {
  const workspace = new ReieWorkspace();
  const result = await ingestReieDocument(workspace, {
    sourceId: "csv-2",
    observedAt: NOW,
    mediaType: "text/csv",
    content: "name,type,location,price\nGalaxy Mall,mall,Sadat City,2500000\n",
  }, {
    entityType: "type",
    canonicalName: "name",
    location: "location",
    claims: { "propertyType": "type", "price.amount": "price" }
  });
  assert.equal(result.parseMode, "csv");
  assert.equal(result.recordsAccepted, 1);
  assert.equal(workspace.getState().claims.length, 2);
  assert.deepEqual(canonicalIngestionRecord({
    entityType: "property",
    canonicalName: "P",
    claims: [{ field: "x", value: 1 }]
  }), '{"canonicalName":"P","claims":[{"field":"x","value":1}],"entityType":"property"}');
});

test("REIE-ING005 generates evidence-linked research opportunities deterministically", async () => {
  const workspace = new ReieWorkspace();
  await ingestReieDocument(workspace, {
    sourceId: "s1",
    observedAt: NOW,
    mediaType: "application/json",
    content: JSON.stringify({ records: [
      { entityId: "p1", entityType: "property", canonicalName: "P", location: "Sadat",
        claims: [
          { field: "price.amount", value: 100 },
          { field: "location", value: "Sadat" },
          { field: "propertyType", value: "land" }
        ] }
      }
    ]})
  });
  const opportunities = deriveReieOpportunities(
    workspace.getState().entities,
    workspace.getState().claims,
    workspace.getState().sources,
    NOW,
  );
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0]?.entityId, "p1");
  assert.equal(opportunities[0]?.status, "RESEARCH");
  assert.ok(opportunities[0]?.evidenceIds.includes("s1") === false);
});
