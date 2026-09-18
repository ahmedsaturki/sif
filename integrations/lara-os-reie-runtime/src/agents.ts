import type { LaraOsReieRuntime } from "./reie.js";
import type { ReieWorkspace } from "./workspace.js";
import { deriveReieOpportunities, type ReieOpportunity } from "./opportunity.js";
import { sha256 } from "./deterministic.js";

export interface ReieAgentContext {
  readonly workspace: ReieWorkspace;
  readonly asOf: string;
  readonly input: unknown;
}

export interface ReieAgent {
  readonly id: string;
  readonly requestedCapabilities: readonly string[];
  run(context: ReieAgentContext): Promise<unknown> | unknown;
}

export interface ReieGovernanceGate {
  check(agent: ReieAgent, context: ReieAgentContext): Promise<void>;
}

export class ReieGovernanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReieGovernanceError";
  }
}

export class SifReieGovernanceGate implements ReieGovernanceGate {
  constructor(private readonly runtime: LaraOsReieRuntime) {}

  async check(agent: ReieAgent, context: ReieAgentContext): Promise<void> {
    if (!this.runtime) throw new ReieGovernanceError("REIE governance runtime is not configured");
    const inputDigest = sha256(context.input);
    const requestId = "agent-policy:" + agent.id + ":" + context.asOf + ":" + inputDigest;
    await this.runtime.policyCheck(
      {
        agentId: agent.id,
        requestedCapabilities: [...agent.requestedCapabilities],
        inputDigest,
      },
      requestId,
      [],
      context.asOf,
      "reie-agent:" + agent.id,
    );
  }
}

export interface ReieAgentRun {
  readonly runId: string;
  readonly agentId: string;
  readonly status: "SUCCESS" | "FAILED";
  readonly output?: unknown;
  readonly error?: string;
}

export class ReieAgentOrchestrator {
  constructor(private readonly governance?: ReieGovernanceGate) {}

  async run(
    agents: readonly ReieAgent[],
    context: ReieAgentContext,
  ): Promise<ReieAgentRun[]> {
    const ordered = [...agents].sort((a, b) => a.id.localeCompare(b.id));
    const results: ReieAgentRun[] = [];
    for (const agent of ordered) {
      const runId = "agent-run:" + agent.id + ":" + context.asOf + ":" + sha256(context.input);
      try {
        if (!this.governance) throw new ReieGovernanceError("No REIE governance gate configured");
        await this.governance.check(agent, context);
        const output = await agent.run(context);
        results.push({ runId, agentId: agent.id, status: "SUCCESS", output: structuredClone(output) });
      } catch (error) {
        results.push({
          runId,
          agentId: agent.id,
          status: "FAILED",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }
}

export const createReieResearchAgent = (): ReieAgent => ({
  id: "research",
  requestedCapabilities: ["sif.knowledge.query", "sif.evaluation.run"],
  run: ({ workspace, asOf }): readonly ReieOpportunity[] => workspace.opportunities(asOf),
});

export const createReieQaAgent = (): ReieAgent => ({
  id: "qa",
  requestedCapabilities: ["sif.knowledge.query"],
  run: ({ workspace }) => {
    const state = workspace.getState();
    const errors: string[] = [];
    const entityIds = new Set(state.entities.map((entity) => entity.entityId));
    const sourceIds = new Set(state.sources.map((source) => source.sourceId));
    for (const claim of state.claims) {
      if (!entityIds.has(claim.entityId)) errors.push("claim:" + claim.claimId + ":missing-entity");
      if (!sourceIds.has(claim.sourceId)) errors.push("claim:" + claim.claimId + ":missing-source");
    }
    return { ok: errors.length === 0, errors: errors.sort(), counts: { ...workspace.runtime.store.counts() } };
  },
});

export const createReieStrategyAgent = (): ReieAgent => ({
  id: "strategy",
  requestedCapabilities: ["sif.evaluation.run"],
  run: ({ workspace, asOf }) => {
    const opportunities = workspace.opportunities(asOf);
    return {
      generatedAt: asOf,
      researchQueue: opportunities.filter((item) => item.status === "RESEARCH").map((item) => item.entityId).sort(),
      monitorQueue: opportunities.filter((item) => item.status === "MONITOR").map((item) => item.entityId).sort(),
    };
  },
});

export const createReieContentAgent = (): ReieAgent => ({
  id: "content",
  requestedCapabilities: ["sif.knowledge.query"],
  run: ({ workspace, input }) => {
    const entityId = typeof input === "string" ? input : "";
    const entity = workspace.runtime.store.getEntity(entityId);
    const state = workspace.getState();
    const claims = state.claims.filter((claim) => claim.entityId === entityId).sort((a, b) => a.field.localeCompare(b.field) || a.claimId.localeCompare(b.claimId));
    const facts = claims.map((claim) => `${claim.field}=${JSON.stringify(claim.value)} [source:${claim.sourceId}]`);
    return {
      entityId,
      headline: entity.canonicalName,
      factualDraft: facts.length ? facts.join("\n") : "No verified claims available.",
      evidenceIds: [...new Set(claims.map((claim) => claim.sourceId))].sort(),
    };
  },
});
