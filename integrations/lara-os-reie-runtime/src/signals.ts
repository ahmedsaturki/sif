import type { ReieClaim, ReieEntity, ReieSource } from "./reie.js";

export type ReieSignalKind =
  | "MULTI_SOURCE_CORROBORATION"
  | "MISSING_CORE_FIELD"
  | "PRICE_CHANGE"
  | "SOURCE_FRESHNESS";

export interface ReieSignal {
  readonly kind: ReieSignalKind;
  readonly entityId: string;
  readonly severity: "INFO" | "ATTENTION";
  readonly detail: string;
  readonly evidenceIds: readonly string[];
}

export interface ReieSignalSnapshot {
  readonly entityId: string;
  readonly signals: readonly ReieSignal[];
  readonly sourceCount: number;
  readonly claimCount: number;
}

const daysBetween = (a: string, b: string): number =>
  Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

function priceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (value && typeof value === "object") {
    const amount = (value as { amount?: unknown }).amount;
    if (typeof amount === "number" && Number.isFinite(amount) && amount >= 0) return amount;
  }
  return null;
}

export function generateReieSignals(
  entity: ReieEntity,
  claims: readonly ReieClaim[],
  sources: readonly ReieSource[],
  asOf: string,
  coreFields = ["price.amount", "location", "propertyType"],
): ReieSignalSnapshot {
  const entityClaims = claims.filter((claim) => claim.entityId === entity.entityId);
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
  const usedSourceIds = [...new Set(entityClaims.map((claim) => claim.sourceId))].sort();
  const signals: ReieSignal[] = [];

  if (usedSourceIds.length >= 2) {
    const byField = new Map<string, Map<string, string[]>>();
    for (const claim of entityClaims) {
      const values = byField.get(claim.field) ?? new Map<string, string[]>();
      const key = JSON.stringify(claim.value);
      const ids = values.get(key) ?? [];
      ids.push(claim.sourceId);
      values.set(key, ids);
      byField.set(claim.field, values);
    }
    const corroborated = [...byField.entries()]
      .filter(([, values]) => [...values.values()].some((ids) => new Set(ids).size >= 2))
      .map(([field]) => field)
      .sort();
    if (corroborated.length) {
      signals.push({
        kind: "MULTI_SOURCE_CORROBORATION",
        entityId: entity.entityId,
        severity: "INFO",
        detail: "Multiple sources independently support: " + corroborated.join(", "),
        evidenceIds: entityClaims.filter((c) => corroborated.includes(c.field)).map((c) => c.sourceId).sort().filter((id, i, a) => i === a.indexOf(id)),
      });
    }
  }

  const presentFields = new Set(entityClaims.map((claim) => claim.field));
  const missing = coreFields.filter((field) => !presentFields.has(field)).sort();
  if (missing.length) {
    signals.push({
      kind: "MISSING_CORE_FIELD",
      entityId: entity.entityId,
      severity: "ATTENTION",
      detail: "Missing core fields: " + missing.join(", "),
      evidenceIds: [],
    });
  }

  const priceClaims = entityClaims
    .filter((claim) => claim.field === "price.amount")
    .map((claim) => ({ claim, amount: priceNumber(claim.value) }))
    .filter((item): item is { claim: ReieClaim; amount: number } => item.amount !== null)
    .sort((a, b) => Date.parse(a.claim.observedAt) - Date.parse(b.claim.observedAt));

  if (priceClaims.length >= 2) {
    const before = priceClaims.at(-2)!;
    const latest = priceClaims.at(-1)!;
    if (before.amount !== 0) {
      const pct = ((latest.amount - before.amount) / before.amount) * 100;
      if (Math.abs(pct) >= 10) {
        signals.push({
          kind: "PRICE_CHANGE",
          entityId: entity.entityId,
          severity: "ATTENTION",
          detail: "Observed price change: " + (Math.round(pct * 10) / 10) + "%",
          evidenceIds: [before.claim.sourceId, latest.claim.sourceId].sort(),
        });
      }
    }
  }

  const observedSources = usedSourceIds.map((id) => sourceById.get(id)).filter((s): s is ReieSource => Boolean(s));
  const stale = observedSources.filter((source) => daysBetween(source.observedAt, asOf) > 30);
  if (observedSources.length && stale.length === observedSources.length) {
    signals.push({
      kind: "SOURCE_FRESHNESS",
      entityId: entity.entityId,
      severity: "ATTENTION",
      detail: "All supporting sources are older than 30 days.",
      evidenceIds: stale.map((source) => source.sourceId).sort(),
    });
  }

  return {
    entityId: entity.entityId,
    signals,
    sourceCount: usedSourceIds.length,
    claimCount: entityClaims.length,
  };
}
