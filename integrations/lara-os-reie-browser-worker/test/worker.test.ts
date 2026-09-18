import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { ReiePlaywrightBrowserWorker, ReieBrowserWorkerError } from "../dist/worker.js";

test("BRW-001 rejects non-http sources before browser work", () => {
  const worker = new ReiePlaywrightBrowserWorker({ userDataDir: "/tmp/reie-browser-test" });
  assert.throws(
    () => (worker as unknown as { validateUri: (uri: string) => URL }).validateUri("file:///tmp/x"),
    (error: unknown) => error instanceof ReieBrowserWorkerError && error.code === "INVALID_URL",
  );
});

test("BRW-002 enforces explicit host allowlists", async () => {
  const worker = new ReiePlaywrightBrowserWorker({
    userDataDir: "/tmp/reie-browser-test",
    allowedHosts: ["example.com"],
  });
  await assert.rejects(
    () => worker.navigate("https://example.org"),
    (error: unknown) => error instanceof ReieBrowserWorkerError && error.code === "HOST_NOT_ALLOWED",
  );
  await worker.close();
});

test("BRW-003 constructs a persistent profile worker without implicit credentials", () => {
  const worker = new ReiePlaywrightBrowserWorker({ userDataDir: "/tmp/reie-browser-profile", headless: false });
  assert.ok(worker);
});

test("BRW-004 launches Chromium and captures a local public page", async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end('<html><head><title>REIE Fixture</title><meta property="og:site_name" content="Fixture Publisher"></head><body><h1>Galaxy Mall</h1><p>Sadat City</p></body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const worker = new ReiePlaywrightBrowserWorker({
    userDataDir: "/tmp/reie-browser-worker-fixture",
    allowedHosts: ["127.0.0.1"],
    headless: true,
  });
  try {
    await worker.navigate(`http://127.0.0.1:${port}/`);
    const capture = await worker.captureCurrentPage();
    assert.equal(capture.title, "REIE Fixture");
    assert.match(capture.content, /Galaxy Mall/);
    assert.match(capture.content, /Sadat City/);
    assert.equal(capture.publisher, "Fixture Publisher");
  } finally {
    await worker.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
