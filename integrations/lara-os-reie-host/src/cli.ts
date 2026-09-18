import { createGovernedReieHost } from "./host.js";

const [command, journal, portText] = process.argv.slice(2);

function usage(): never {
  console.error("Usage: reie-host serve <journalPath> [port]");
  process.exit(2);
}

if (command !== "serve" || !journal) usage();

const port = portText === undefined ? 8787 : Number(portText);
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
