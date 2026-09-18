import test from "node:test";
import assert from "node:assert/strict";
import { calculateResearchPriority } from "../dist/priority.js";
import { fetchPublicSource } from "../dist/web-fetch.js";
import { LaraOsReieRuntime, InMemoryReieStore, type ReieEntity } from "../dist/reie.js";

const NOW = "2026-09-18T00:00:00.000Z";

test("REIE-LC007 research priority is deterministic and evidence-derived", () => {
  const entity: ReieEntity = { entityId: "p1", entityType: "property", canonicalName: "P", location: "Sadat", aliases: [] };
  const result = calculateResearchPriority(
    entity,
    [
      { claimId: "c1", entityId: "p1", sourceId: "s1", field: "price.amount", value: 100, observedAt: NOW },
      { claimId: "c2", entityId: "p1", sourceId: "s2", field: "price.amount", value: 120, observedAt: NOW },
      { claimId: "c3", entityId: "p1", sourceId: "s1", field: "location", value: "Sadat", observedAt: NOW },
      { claimId: "c4", entityId: "p1", sourceId: "s2", field: "propertyType", value: "land", observedAt: NOW },
    ],
    [
      { sourceId: "s1", observedAt: NOW, contentDigest: "d1" },
      { sourceId: "s2", observedAt: NOW, contentDigest: "d2" },
    ],
    NOW,
  );
  assert.equal(result.score, 100);
  assert.equal(result.band, "HIGH");
  assert.deepEqual(result.signalKinds, ["MULTI_SOURCE_CORROBORATION", "PRICE_CHANGE"]);
});

test("REIE-LC008 public fetch rejects non-http schemes before network access", async () => {
  await assert.rejects(
    () => fetchPublicSource({ url: "file:///tmp/a", sourceId: "x", observedAt: NOW }),
    /Only HTTP\(S\) public sources are allowed/,
  );
});

test("REIE-LC009 systemic and continuity calls preserve explicit SIF contracts", async () => {
  const calls: unknown[] = [];
  const bridge = {
    execute: async (input: unknown) => {
      calls.push(input);
      return {
        response: {
          status: "PASS",
          productId: "LARA_OS_REIE",
          operation: (input as { operation: string }).operation,
        },
        evidence: {},
        replayVerified: true,
      };
    },
  };
  const runtime = new LaraOsReieRuntime(new InMemoryReieStore(), bridge);
  await runtime.systemicQuery({}, "systemic-1", [], NOW);
  await runtime.continuityRead({}, "continuity-1", [], NOW);

  assert.deepEqual(
    calls.map((input) => {
      const value = input as { operation: string; requestedCapabilities: string[]; authorityScopes: string[] };
      return [value.operation, value.requestedCapabilities, value.authorityScopes];
    }),
    [
      ["systemic.query", ["sif.systemic.query"], ["product:lara:read"]],
      ["continuity.read", ["sif.continuity.read"], ["product:lara:read"]],
    ],
  );
});
