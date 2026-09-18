import {
  makeSifIntegrationEnvelope,
  type SifIntegrationEnvelope,
  type SifIntegrationExecution,
  type SifAdoptionGateway,
} from "./adoption.js";
import type { SifProductRequest } from "../../../packages/sif-core/dist/src/index.js";

export interface ReieSifInvocation {
  readonly requestId: string;
  readonly operation: SifProductRequest["operation"];
  readonly requestedCapabilities: readonly string[];
  readonly authorityScopes: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly payload: unknown;
  readonly correlationId: string;
  readonly requestedAt: string;
  readonly sourceSystem?: string;
}

export interface ReieSifBridge {
  execute(input: ReieSifInvocation): Promise<SifIntegrationExecution>;
}

export function makeReieSifEnvelope(
  input: ReieSifInvocation,
): SifIntegrationEnvelope {
  const request: SifProductRequest = {
    requestId: input.requestId,
    productId: "LARA_OS_REIE",
    adapterVersion: "1.0.0",
    operation: input.operation,
    requestedCapabilities: [...input.requestedCapabilities],
    authorityScopes: [...input.authorityScopes],
    evidenceIds: [...input.evidenceIds],
    payload: structuredClone(input.payload),
    createdAt: input.requestedAt,
  };

  return makeSifIntegrationEnvelope(
    request,
    input.sourceSystem ?? "lara-os-reie",
    input.correlationId,
    input.requestedAt,
  );
}

export function createReieSifBridge(
  gateway: SifAdoptionGateway,
): ReieSifBridge {
  return {
    execute(input: ReieSifInvocation) {
      return gateway.execute(makeReieSifEnvelope(input));
    },
  };
}

export function reiePolicyCheck(
  bridge: ReieSifBridge,
  input: Omit<ReieSifInvocation, "operation" | "requestedCapabilities"> & {
    requestedCapabilities?: readonly string[];
  },
): Promise<SifIntegrationExecution> {
  return bridge.execute({
    ...input,
    operation: "policy.check",
    requestedCapabilities: input.requestedCapabilities ?? ["sif.policy.check"],
  });
}

export function reieKnowledgeQuery(
  bridge: ReieSifBridge,
  input: Omit<ReieSifInvocation, "operation" | "requestedCapabilities"> & {
    requestedCapabilities?: readonly string[];
  },
): Promise<SifIntegrationExecution> {
  return bridge.execute({
    ...input,
    operation: "knowledge.query",
    requestedCapabilities: input.requestedCapabilities ?? ["sif.knowledge.query"],
  });
}

export function reieEvaluationRun(
  bridge: ReieSifBridge,
  input: Omit<ReieSifInvocation, "operation" | "requestedCapabilities"> & {
    requestedCapabilities?: readonly string[];
  },
): Promise<SifIntegrationExecution> {
  return bridge.execute({
    ...input,
    operation: "evaluation.run",
    requestedCapabilities: input.requestedCapabilities ?? ["sif.evaluation.run"],
  });
}

export function reieSystemicQuery(
  bridge: ReieSifBridge,
  input: Omit<ReieSifInvocation, "operation" | "requestedCapabilities"> & {
    requestedCapabilities?: readonly string[];
  },
): Promise<SifIntegrationExecution> {
  return bridge.execute({
    ...input,
    operation: "systemic.query",
    requestedCapabilities: input.requestedCapabilities ?? ["sif.systemic.query"],
  });
}

export function reieContinuityRead(
  bridge: ReieSifBridge,
  input: Omit<ReieSifInvocation, "operation" | "requestedCapabilities"> & {
    requestedCapabilities?: readonly string[];
  },
): Promise<SifIntegrationExecution> {
  return bridge.execute({
    ...input,
    operation: "continuity.read",
    requestedCapabilities: input.requestedCapabilities ?? ["sif.continuity.read"],
  });
}
