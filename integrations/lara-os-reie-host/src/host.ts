import {
  createDefaultSifAdoptionGateway,
  createReieSifBridge,
  type StandardSifHandlers,
} from "../../sif-adoption/dist/index.js";
import {
  InMemoryReieStore,
  LaraOsReieRuntime,
} from "../../lara-os-reie-runtime/dist/reie.js";
import { ReieLocalServer } from "../../lara-os-reie-runtime/dist/server.js";
import { SifReieGovernanceGate } from "../../lara-os-reie-runtime/dist/agents.js";

export interface GovernedReieHostOptions {
  readonly journalPath: string;
  readonly operationalPath?: string;
  readonly port?: number;
  readonly allowedAgents?: readonly string[];
}

export interface GovernedReieHost {
  readonly gateway: ReturnType<typeof createDefaultSifAdoptionGateway>;
  readonly server: ReieLocalServer;
  readonly allowedAgents: readonly string[];
}

function makeHandlers(allowedAgents: readonly string[]): StandardSifHandlers {
  const allow = new Set(allowedAgents);
  return {
    "policy.check": ({ request }) => {
      const payload = request.payload as {
        agentId?: unknown;
        requestedCapabilities?: unknown;
        inputDigest?: unknown;
      };
      const agentId = String(payload.agentId ?? "");
      const requestedCapabilities = Array.isArray(payload.requestedCapabilities)
        ? payload.requestedCapabilities.map(String).sort()
        : [];
      const inputDigest = String(payload.inputDigest ?? "");
      const accepted = allow.has(agentId) && requestedCapabilities.length > 0 && inputDigest.length > 0;
      return {
        accepted,
        agentId,
        requestedCapabilities,
        inputDigest,
        reason: accepted ? "locally authorized safe agent" : "agent is not allowlisted or request is incomplete",
      };
    },
    "knowledge.query": ({ request }) => ({ accepted: true, payload: request.payload }),
    "evaluation.run": ({ request }) => ({ accepted: true, payload: request.payload }),
    "systemic.query": ({ request }) => ({ accepted: true, payload: request.payload }),
    "continuity.read": ({ request }) => ({ accepted: true, payload: request.payload }),
    "federation.inspect": ({ request }) => ({ accepted: true, payload: request.payload }),
  };
}

export function createGovernedReieHost(
  options: GovernedReieHostOptions,
): GovernedReieHost {
  const allowedAgents = [...new Set((options.allowedAgents ?? ["content", "qa", "research", "strategy"]).map((id) => id.trim()).filter(Boolean))].sort();
  if (!allowedAgents.length) throw new Error("allowedAgents must contain at least one agent");
  if (!options.journalPath.trim()) throw new Error("journalPath must not be empty");

  const gateway = createDefaultSifAdoptionGateway(makeHandlers(allowedAgents));
  const bridge = createReieSifBridge(gateway);
  const sifRuntime = new LaraOsReieRuntime(new InMemoryReieStore(), bridge);
  const governance = new SifReieGovernanceGate(sifRuntime);
  const server = new ReieLocalServer({
    journalPath: options.journalPath,
    ...(options.operationalPath ? { operationalPath: options.operationalPath } : {}),
    ...(options.port !== undefined ? { port: options.port } : {}),
    governance,
  });

  return { gateway, server, allowedAgents };
}
