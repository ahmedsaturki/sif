import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGovernedReieHost } from "../src/host.js";

const NOW = "2026-09-18T12:00:00.000Z";

test("HOST-001 governed agents execute through the SIF gateway", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reie-host-"));
  const journal = join(dir, "events.jsonl");
  const host = createGovernedReieHost({ journalPath: journal, port: 0 });
  const bound = await host.server.start();
  try {
    const ingest = await fetch(`http://${bound.host}:${bound.port}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        document: {
          sourceId: "host-source",
          observedAt: NOW,
          mediaType: "application/json",
          content: JSON.stringify({
            records: [{
              entityId: "host-p1",
              entityType: "property",
              canonicalName: "Host Property",
              location: "Sadat",
              claims: [{ field: "propertyType", value: "land" }],
            }],
          }),
        },
      }),
    });
    assert.equal(ingest.status, 200);

    const run = await fetch(`http://${bound.host}:${bound.port}/agents/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agents: ["qa", "research", "strategy"],
        input: null,
        asOf: NOW,
      }),
    });
    assert.equal(run.status, 200);
    const body = await run.json();
    assert.equal(body.length, 3);
    assert.equal(body.every((item) => item.status === "SUCCESS"), true);

    const runs = await fetch(`http://${bound.host}:${bound.port}/agent-runs`);
    assert.equal(runs.status, 200);
    assert.equal((await runs.json()).length, 3);
  } finally {
    await host.server.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("HOST-002 non-allowlisted agent fails through the SIF governance path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reie-host-deny-"));
  const host = createGovernedReieHost({ journalPath: join(dir, "events.jsonl"), port: 0, allowedAgents: ["qa"] });
  const bound = await host.server.start();
  try {
    const response = await fetch(`http://${bound.host}:${bound.port}/agents/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agents: ["research"], asOf: NOW, input: null }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body[0].status, "FAILED");
    assert.match(body[0].error, /Operation handler failed|not allowlisted|FAIL/);
  } finally {
    await host.server.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
