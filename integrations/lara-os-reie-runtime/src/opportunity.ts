import type { ReieClaim, ReieEntity, ReieSource } from "./reie.js";
import { calculateResearchPriority, type ReieResearchPriority } from "./priority.js";
import { generateReieSignals, type ReieSignal } from "./signals.js";

export type ReieOpportunityStatus = "RESEARCH" | "MONITOR";

export interface ReieOpportunity {
  readonly entityId: string;
  readonly status: ReieOpportunityStatus;
  readonly priority: ReieResearchPriority;
  readonly signals: readonly ReieSignal[];
  readonly evidenceIds: readonly string[];
}

export function deriveReieOpportunities(
  entities: readonly ReieEntity[],
  claims: readonly ReieClaim[],
  sources: readonly ReieSource[],
  asOf: string,
): ReieOpportunity[] {
  const opportunities = entities.map((entity) => {
    const priority = calculateResearchPriority(entity, claims, sources, asOf);
    const signalSnapshot = generateReieSignals(entity, claims, sources, asOf);
    const evidenceIds = [...new Set(signalSnapshot.signals.flatMap((signal) => signal.evidenceIds))].sort();
    const status: ReieOpportunityStatus = priority.score >= 45 || signalSnapshot.signals.some((signal) => signal.severity === "ATTENTION")
      ? "RESEARCH"
      : "MONITOR";
    return {
      entityId: entity.entityId,
      status,
      priority,
      signals: signalSnapshot.signals,
      evidenceIds,
    };
  });

  return opportunities.sort((a, b) =>
    b.priority.score - a.priority.score || a.entityId.localeCompare(b.entityId),
  );
}
