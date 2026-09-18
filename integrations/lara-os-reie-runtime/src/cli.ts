#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { openReieWorkspace } from "./persistence.js";
import type { ReieCsvMapping } from "./ingestion.js";

function usage(): never {
  console.error(`REIE Local Core

Commands:
  init <journal>
  demo <journal>
  health <journal>
  query <journal> <text>
  evaluate <journal> <entityId>
  resolve <journal> <type> <name> [location]
  signals <journal> <entityId> [asOf]
  export <journal> <snapshot>
  import <journal> <snapshot>
  ingest <journal> <file> <sourceId> [mediaType] [mappingJson]
  opportunities <journal> [asOf]
`);
  process.exit(2);
}

const mediaTypeForFile = (path: string, explicit?: string) => {
  if (explicit) {
    if (explicit === "application/json" || explicit === "text/csv" || explicit === "text/plain") return explicit;
    throw new Error("mediaType must be application/json, text/csv, or text/plain");
  }
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) return "application/json" as const;
  if (lower.endsWith(".csv")) return "text/csv" as const;
  return "text/plain" as const;
};

const [command, ...args] = process.argv.slice(2);
if (!command) usage();

const journal = args[0];
if (!journal) usage();

const main = async () => {
  const store = await openReieWorkspace(journal);

  switch (command) {
    case "init":
      console.log(JSON.stringify({ ok: true, journal }, null, 2));
      return;
    case "health":
      console.log(JSON.stringify(store.counts(), null, 2));
      return;
    case "query":
      if (!args[1]) usage();
      console.log(JSON.stringify(store.workspace.knowledge(args.slice(1).join(" ")), null, 2));
      return;
    case "evaluate":
      if (!args[1]) usage();
      console.log(JSON.stringify(store.workspace.evaluate(args[1]), null, 2));
      return;
    case "resolve":
      if (!args[2]) usage();
      console.log(JSON.stringify(store.workspace.resolve({
        entityType: args[1] as any,
        canonicalName: args[2],
        ...(args[3] ? { location: args[3] } : {}),
      }), null, 2));
      return;
    case "signals":
      if (!args[1]) usage();
      console.log(JSON.stringify(store.workspace.signals(args[1], args[2] ?? new Date().toISOString()), null, 2));
      return;
    case "export":
      if (!args[1]) usage();
      console.log(JSON.stringify(await store.exportSnapshot(args[1]), null, 2));
      return;
    case "import":
      if (!args[1]) usage();
      console.log(JSON.stringify(await store.importSnapshot(args[1]), null, 2));
      return;
    case "ingest": {
      if (!args[1] || !args[2]) usage();
      const file = args[1];
      const sourceId = args[2];
      const mediaType = mediaTypeForFile(file, args[3]);
      let csvMapping: ReieCsvMapping | undefined;
      if (mediaType === "text/csv") {
        if (!args[4]) usage();
        try {
          csvMapping = JSON.parse(args[4]) as ReieCsvMapping;
        } catch {
          throw new Error("mappingJson must be valid JSON");
        }
      }
      const content = await readFile(file, "utf8");
      const result = await store.ingestDocument({
        sourceId,
        title: file,
        observedAt: new Date().toISOString(),
        content,
        mediaType,
      }, csvMapping);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "opportunities":
      console.log(JSON.stringify(store.opportunities(args[1] ?? new Date().toISOString()), null, 2));
      return;
    case "demo": {
      if (store.counts().entities > 0) {
        console.log(JSON.stringify({ ok: true, alreadySeeded: true, ...store.counts() }, null, 2));
        return;
      }
      const now = new Date().toISOString();
      await store.ingestSource({ sourceId: "demo-source-owner", title: "Owner listing", observedAt: now, contentDigest: "demo-owner-v1" });
      await store.ingestSource({ sourceId: "demo-source-broker", title: "Broker listing", observedAt: now, contentDigest: "demo-broker-v1" });
      await store.upsertEntity({ entityId: "demo-property-1", entityType: "property", canonicalName: "Galaxy Mall", location: "Sadat City", aliases: ["Galaxy"] });
      await store.recordClaim({ claimId: "demo-c1", entityId: "demo-property-1", sourceId: "demo-source-owner", field: "location", value: "Sadat City", observedAt: now });
      await store.recordClaim({ claimId: "demo-c2", entityId: "demo-property-1", sourceId: "demo-source-broker", field: "location", value: "Sadat City", observedAt: now });
      await store.recordClaim({ claimId: "demo-c3", entityId: "demo-property-1", sourceId: "demo-source-owner", field: "price.amount", value: 1000000, observedAt: now });
      await store.recordClaim({ claimId: "demo-c4", entityId: "demo-property-1", sourceId: "demo-source-broker", field: "price.amount", value: 1000000, observedAt: now });
      console.log(JSON.stringify(store.counts(), null, 2));
      return;
    }
    default:
      usage();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
