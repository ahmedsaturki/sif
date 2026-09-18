import type { ReieClaim, ReieEntity, ReieSource } from "./reie.js";
import { generateReieSignals } from "./signals.js";

export type ReiePriorityBand = "LOW" | "MEDIUM" | "HIGH";

export interface ReieResearchPriority {
  readonly entityId: string;
  readonly score: number;
  readonly band: ReiePriorityBand;
  readonly reasons: readonly string[];
  readonly signalKinds: readonly string[];
}

export function calculateResearchPriority(
  entity: ReieEntity,
  claims: readonly ReieClaim[],
  sources: readonly ReieSource[],
  asOf: string,
): ReieResearchPriority {
  const entityClaims = claims.filter((claim) => claim.entityId === entity.entityId);
  const signals = generateReieSignals(entity, claims, sources, asOf);
  const reasons: string[] = [];
  let score = 0;

  if (signals.sourceCount >= 2) {
    score += 25;
    reasons.push("multiple supporting sources");
  }

  const fields = new Set(entityClaims.map((claim) => claim.field));
  const required = ["price.amount", "location", "propertyType"];
  const complete = required.filter((field) => fields.has(field)).length;
  score += complete * 10;
  if (complete === required.length) reasons.push("core property fields complete");

  const latest = sources
    .filter((source) => entityClaims.some((claim) => claim.sourceId === source.sourceId))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];

  if (latest) {
    const ageDays = Math.max(0, (Date.parse(asOf) - Date.parse(latest.observedAt)) / 86_400_000);
    if (ageDays <= 7) {
      score += 25;
      reasons.push("supporting source is fresh");
    } else if (ageDays <= 30) {
      score += 10;
      reasons.push("supporting source is recent");
    }
  }

  if (signals.signals.some((signal) => signal.kind === "PRICE_CHANGE")) {
    score += 15;
    reasons.push("material observed price change");
  }
  if (!signals.signals.some((signal) => signal.kind === "MISSING_CORE_FIELD")) {
    score += 10;
  }

  score = Math.min(100, Math.max(0, Math.round(score)));
  const band: ReiePriorityBand = score >= 75 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";

  return {
    entityId: entity.entityId,
    score,
    band,
    reasons: [...new Set(reasons)].sort(),
    signalKinds: signals.signals.map((signal) => signal.kind).sort(),
  };
}
