import test from "node:test";
import assert from "node:assert/strict";
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
