import test from "node:test";
import assert from "node:assert/strict";
import { ReiePublicSourceCollector } from "../src/collector.js";

test("HOST-003 public collector passes browser capture to source-only ingestion", async () => {
  const calls: string[] = [];
  const browser = {
    async navigate(uri: string) { calls.push("navigate:" + uri); },
    async captureCurrentPage(uri: string) {
      calls.push("capture:" + uri);
      return {
        uri,
        title: "Fixture",
        publisher: "Fixture Publisher",
        observedAt: "2026-09-18T12:00:00.000Z",
        content: "Galaxy Mall Sadat City",
        mediaType: "text/plain" as const,
      };
    },
  } as never;
  const docs: unknown[] = [];
  const workspace = {
    async ingestDocument(document: unknown) { docs.push(document); return { recordsAccepted: 0 }; },
  };
  const collector = new ReiePublicSourceCollector(browser, workspace);
  const result = await collector.collect("source-1", "https://example.com");
  assert.equal(result.capture.title, "Fixture");
  assert.deepEqual(calls, ["navigate:https://example.com", "capture:https://example.com"]);
  assert.equal(docs.length, 1);
  assert.equal((docs[0] as { sourceId: string }).sourceId, "source-1");
});
