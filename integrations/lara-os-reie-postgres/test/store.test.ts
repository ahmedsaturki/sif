import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { ReiePostgresStore } from "../dist/store.js";

const connectionString = process.env.REIE_TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/reie";
const store = ReiePostgresStore.fromConfig({ connectionString });
const observedAt = "2026-09-18T12:00:00.000Z";

before(async () => {
  await store.migrate();
  await store.pool.query("TRUNCATE reie_claims, reie_entities, reie_sources CASCADE");
});

test("PG-001 migrates and round-trips REIE state", async () => {
  await store.ingestSource({ sourceId: "s1", observedAt, contentDigest: "digest-1", title: "Fixture", publisher: "REIE Test" });
  await store.upsertEntity({ entityId: "p1", entityType: "property", canonicalName: "Galaxy Mall", location: "Sadat City", aliases: ["Galaxy"] });
  await store.recordClaim({ claimId: "c1", entityId: "p1", sourceId: "s1", field: "price.amount", value: 2500000, observedAt });

  const state = await store.getState();
  assert.equal(state.sources.length, 1);
  assert.equal(state.entities[0]?.canonicalName, "Galaxy Mall");
  assert.equal(state.claims[0]?.value, 2500000);
  assert.deepEqual(await store.knowledge("Galaxy Sadat"), {
    query: "galaxy sadat",
    entityIds: ["p1"],
    claimIds: ["c1"],
    sourceIds: ["s1"],
  });
});

test("PG-002 rejects canonical collisions and preserves original entity", async () => {
  await assert.rejects(
    () => store.upsertEntity({ entityId: "p2", entityType: "property", canonicalName: "Galaxy Mall", location: "Sadat City", aliases: [] }),
    /Canonical entity already maps to p1|duplicate key/,
  );
  const state = await store.getState();
  assert.equal(state.entities.length, 1);
  assert.equal(state.entities[0]?.entityId, "p1");
});

test("PG-003 source and claim writes are idempotent but conflicts fail closed", async () => {
  await store.ingestSource({ sourceId: "s1", observedAt, contentDigest: "digest-1", title: "Fixture", publisher: "REIE Test" });
  await store.ingestSource({ sourceId: "s1", observedAt, contentDigest: "digest-1", title: "Fixture", publisher: "REIE Test" });
  await assert.rejects(
    () => store.ingestSource({ sourceId: "s1", observedAt, contentDigest: "changed" }),
    /different content/,
  );

  await store.recordClaim({ claimId: "c1", entityId: "p1", sourceId: "s1", field: "price.amount", value: 2500000, observedAt });
  await store.recordClaim({ claimId: "c1", entityId: "p1", sourceId: "s1", field: "price.amount", value: 2500000, observedAt });
  await assert.rejects(
    () => store.recordClaim({ claimId: "c1", entityId: "p1", sourceId: "s1", field: "price.amount", value: 2700000, observedAt }),
    /different value/,
  );
});

test("PG-004 foreign keys reject claims for unknown source or entity", async () => {
  await assert.rejects(
    () => store.recordClaim({ claimId: "missing-source", entityId: "p1", sourceId: "nope", field: "x", value: 1, observedAt }),
    /Referenced REIE source or entity was not found|foreign key/,
  );
  await assert.rejects(
    () => store.recordClaim({ claimId: "missing-entity", entityId: "nope", sourceId: "s1", field: "x", value: 1, observedAt }),
    /Referenced REIE source or entity was not found|foreign key/,
  );
});

test("PG-005 concurrent canonical upserts allow exactly one identity", async () => {
  const first = store.upsertEntity({ entityId: "p3", entityType: "property", canonicalName: "Concurrent Site", location: "Sadat", aliases: [] });
  const second = store.upsertEntity({ entityId: "p4", entityType: "property", canonicalName: "Concurrent Site", location: "Sadat", aliases: [] });
  const results = await Promise.allSettled([first, second]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
});

test("PG-006 evaluation is derived from persisted claims and sources", async () => {
  await store.ingestSource({ sourceId: "s2", observedAt, contentDigest: "digest-2" });
  await store.recordClaim({ claimId: "c2", entityId: "p1", sourceId: "s2", field: "location", value: "Sadat City", observedAt });
  await store.recordClaim({ claimId: "c3", entityId: "p1", sourceId: "s2", field: "propertyType", value: "mall", observedAt });
  const evaluation = await store.evaluate("p1");
  assert.equal(evaluation.claimCount, 3);
  assert.equal(evaluation.sourceCount, 2);
  assert.equal(evaluation.corroboratedFields.includes("location"), true);
});

after(async () => {
  await store.close();
});
