import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryReieStore,
  LaraOsReieRuntime,
  ReieRuntimeError,
} from "../dist/src/reie.js";

const NOW = "2026-09-18T00:00:00.000Z";

function seed(runtime: LaraOsReieRuntime) {
  runtime.ingestSource({
    sourceId: "s1",
    title: "Owner listing",
    observedAt: NOW,
    contentDigest: "sha256:s1",
  });
  runtime.ingestSource({
    sourceId: "s2",
    title: "Broker listing",
    observedAt: NOW,
    contentDigest: "sha256:s2",
  });
  runtime.upsertEntity({
    entityId: "p1",
    entityType: "property",
    canonicalName: "Galaxy Mall",
    location: "Sadat City",
    aliases: ["Galaxy", "Galaxy Mall Sadat"],
  });
  runtime.recordClaim({
    claimId: "c1",
    entityId: "p1",
    sourceId: "s1",
    field: "project",
    value: "Galaxy Mall",
    observedAt: NOW,
  });
  runtime.recordClaim({
    claimId: "c2",
    entityId: "p1",
    sourceId: "s2",
    field: "project",
    value: "Galaxy Mall",
    observedAt: NOW,
  });
  runtime.recordClaim({
    claimId: "c3",
    entityId: "p1",
    sourceId: "s2",
    field: "city",
    value: "Sadat City",
    observedAt: NOW,
  });
  runtime.recordClaim({
    claimId: "c4",
    entityId: "p1",
    sourceId: "s1",
    field: "city",
    value: "Sadat City",
    observedAt: NOW,
  });
}

test("REIE-R001 ingests sources, entities, and claims deterministically", () => {
  const runtime = new LaraOsReieRuntime();
  seed(runtime);
  assert.deepEqual(runtime.store.counts(), { sources: 2, entities: 1, claims: 4 });
  assert.deepEqual(runtime.knowledge("Galaxy Sadat City"), {
    query: "city galaxy sadat",
    entityIds: ["p1"],
    claimIds: ["c1", "c2", "c3", "c4"],
    sourceIds: ["s1", "s2"],
  });
});

test("REIE-R002 rejects canonical entity collisions", () => {
  const store = new InMemoryReieStore();
  store.upsertEntity({
    entityId: "a",
    entityType: "property",
    canonicalName: "Same Property",
    location: "Sadat",
    aliases: [],
  });
  assert.throws(
    () =>
      store.upsertEntity({
        entityId: "b",
        entityType: "property",
        canonicalName: "Same Property",
        location: "Sadat",
        aliases: [],
      }),
    (e: unknown) => e instanceof ReieRuntimeError && e.code === "CONFLICT",
  );
});

test("REIE-R003 evaluates corroborated entity knowledge", () => {
  const runtime = new LaraOsReieRuntime();
  seed(runtime);
  assert.deepEqual(runtime.evaluate("p1"), {
    entityId: "p1",
    claimCount: 4,
    sourceCount: 2,
    corroboratedFields: ["city", "project"],
    confidenceBand: "HIGH",
  });
});

test("REIE-R004 uses fail-closed SIF policy when authority is not accepted", async () => {
  let observed: any;
  const bridge = {
    execute: async (input: any) => {
      observed = input;
      return {
        response: {
          status: "FAIL",
          productId: "LARA_OS_REIE",
          operation: input.operation,
        },
        evidence: {},
        replayVerified: false,
      };
    },
  };
  const runtime = new LaraOsReieRuntime(undefined, bridge);
  const result = await runtime.policyCheck({ action: "write" }, "r1", ["s1"], NOW);
  assert.equal(result.response.status, "FAIL");
  assert.equal(observed.authorityScopes[0], "product:lara:read");
  assert.equal(observed.sourceSystem, "lara-os-reie");
});

test("REIE-R005 requires explicit SIF configuration", async () => {
  const runtime = new LaraOsReieRuntime();
  await assert.rejects(
    () => runtime.knowledgeQuery({}, "r2", [], NOW),
    (e: unknown) => e instanceof ReieRuntimeError && e.code === "NOT_FOUND",
  );
});

test("REIE-R006 uses the real SIF Adoption bridge when configured", async () => {
  const { createDefaultSifAdoptionGateway } = await import("../../sif-adoption/src/adoption.js");
  const { createReieSifBridge } = await import("../../sif-adoption/src/reie.js");
  const handlers = {
    "policy.check": ({ request }: any) => ({ accepted: true, payload: request.payload }),
    "knowledge.query": ({ request }: any) => ({ knowledge: request.payload }),
    "evaluation.run": ({ request }: any) => ({ evaluation: request.payload }),
    "systemic.query": ({ request }: any) => ({ systemic: request.payload }),
    "continuity.read": ({ request }: any) => ({ continuity: request.payload }),
    "federation.inspect": ({ request }: any) => ({ federation: request.payload }),
  };
  const bridge = createReieSifBridge(createDefaultSifAdoptionGateway(handlers));
  const runtime = new LaraOsReieRuntime(new InMemoryReieStore(), bridge);
  const result = await runtime.knowledgeQuery(
    { entityId: "P-1", query: "facts" },
    "sif-reie-real-1",
    ["source-1"],
    NOW,
  );
  assert.equal(result.response.productId, "LARA_OS_REIE");
  assert.equal(result.response.status, "PASS");
  assert.equal(result.replayVerified, true);
});
