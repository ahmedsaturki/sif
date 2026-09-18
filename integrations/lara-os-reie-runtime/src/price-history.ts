import type { ReieClaim } from "./reie.js";

export interface ReiePricePoint {
  readonly claimId: string;
  readonly entityId: string;
  readonly sourceId: string;
  readonly observedAt: string;
  readonly amount: number;
}

export interface ReiePriceChange {
  readonly from: ReiePricePoint;
  readonly to: ReiePricePoint;
  readonly percent: number;
}

function amountOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (value && typeof value === "object") {
    const amount = (value as { amount?: unknown }).amount;
    if (typeof amount === "number" && Number.isFinite(amount) && amount >= 0) return amount;
  }
  return null;
}

export function deriveReiePriceHistory(
  entityId: string,
  claims: readonly ReieClaim[],
): ReiePricePoint[] {
  return claims
    .filter((claim) => claim.entityId === entityId && claim.field === "price.amount")
    .map((claim) => {
      const amount = amountOf(claim.value);
      return amount === null ? null : {
        claimId: claim.claimId,
        entityId: claim.entityId,
        sourceId: claim.sourceId,
        observedAt: new Date(Date.parse(claim.observedAt)).toISOString(),
        amount,
      };
    })
    .filter((point): point is ReiePricePoint => point !== null)
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.claimId.localeCompare(b.claimId));
}

export function deriveReiePriceChanges(history: readonly ReiePricePoint[]): ReiePriceChange[] {
  const changes: ReiePriceChange[] = [];
  for (let i = 1; i < history.length; i += 1) {
    const from = history[i - 1]!;
    const to = history[i]!;
    const percent = from.amount === 0 ? (to.amount === 0 ? 0 : 100) : ((to.amount - from.amount) / from.amount) * 100;
    changes.push({ from, to, percent: Math.round(percent * 100) / 100 });
  }
  return changes;
}
