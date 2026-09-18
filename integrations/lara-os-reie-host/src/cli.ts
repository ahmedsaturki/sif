import { createGovernedReieHost } from "./host.js";
import { ReiePublicSourceCollector } from "./collector.js";
import { ReiePlaywrightBrowserWorker } from "../../lara-os-reie-browser-worker/dist/worker.js";
import { openReieWorkspace } from "../../lara-os-reie-runtime/dist/persistence.js";
import { ReieSourceArtifactStore } from "../../lara-os-reie-runtime/dist/source-artifacts.js";

const [command, journal, arg3, arg4, arg5] = process.argv.slice(2);

function usage(): never {
  console.error("Usage: reie-host serve <journalPath> [port]");
  console.error("       reie-host collect <journalPath> <sourceId> <uri> [profileDir]");
  process.exit(2);
}

if (!journal) usage();

if (command === "serve") {
  const port = arg3 === undefined ? 8787 : Number(arg3);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) usage();
  const host = createGovernedReieHost({ journalPath: journal, port });
  const bound = await host.server.start();
  console.log(JSON.stringify({
    ok: true,
    host: bound.host,
    port: bound.port,
    allowedAgents: host.allowedAgents,
    message: "Governed REIE host is running on loopback.",
  }, null, 2));
  await new Promise<void>(() => {});
}

if (command === "collect") {
  const sourceId = arg3;
  const uri = arg4;
  const profileDir = arg5 ?? "./data/browser-profile";
  if (!sourceId || !uri) usage();

  const workspace = await openReieWorkspace(journal);
  const browser = new ReiePlaywrightBrowserWorker({
    userDataDir: profileDir,
    headless: true,
  });
  const collector = new ReiePublicSourceCollector(browser, workspace, new ReieSourceArtifactStore(journal + ".artifacts"));
  try {
    const result = await collector.collect(sourceId, uri);
    console.log(JSON.stringify({
      ok: true,
      sourceId,
      uri: result.capture.uri,
      title: result.capture.title,
      publisher: result.capture.publisher,
      recordsAccepted: (result.ingestion as { recordsAccepted?: number }).recordsAccepted ?? 0,
      message: "Public source captured and preserved as REIE source-only evidence.",
    }, null, 2));
  } finally {
    await browser.close();
  }
}

if (command !== "serve" && command !== "collect") usage();
