import type { ReieEntity } from "./reie.js";
import { tokenize } from "./deterministic.js";

export type ReieMatchBand = "EXACT" | "STRONG" | "REVIEW" | "WEAK";

export interface ReieResolutionInput {
  readonly entityType: ReieEntity["entityType"];
  readonly canonicalName: string;
  readonly location?: string;
  readonly aliases?: readonly string[];
}

export interface ReieResolutionCandidate {
  readonly entityId: string;
  readonly score: number;
  readonly band: ReieMatchBand;
  readonly matchedSignals: readonly string[];
}

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const left = new Set(a);
  const right = new Set(b);
  let hits = 0;
  for (const token of left) if (right.has(token)) hits++;
  return hits / new Set([...left, ...right]).size;
}

function exact(a: string, b: string): boolean {
  return tokenize(a).join(" ") === tokenize(b).join(" ");
}

export function resolveEntityCandidates(
  input: ReieResolutionInput,
  entities: readonly ReieEntity[],
): ReieResolutionCandidate[] {
  const requestedName = tokenize(input.canonicalName);
  const requestedAliases = [...(input.aliases ?? [])].flatMap(tokenize);
  const requestedLocation = tokenize(input.location ?? "");

  return entities
    .filter((entity) => entity.entityType === input.entityType)
    .map((entity) => {
      const signals: string[] = [];
      const canonicalExact = exact(input.canonicalName, entity.canonicalName);
      const aliasExact = entity.aliases.some((alias) => exact(input.canonicalName, alias));
      const nameOverlap = Math.max(
        overlap(requestedName, tokenize(entity.canonicalName)),
        ...entity.aliases.map((alias) => overlap(requestedName, tokenize(alias))),
        0,
      );
      const aliasOverlap = requestedAliases.length
        ? Math.max(
            overlap(requestedAliases, tokenize(entity.canonicalName)),
            ...entity.aliases.map((alias) => overlap(requestedAliases, tokenize(alias))),
            0,
          )
        : 0;
      const locationOverlap = requestedLocation.length
        ? overlap(requestedLocation, tokenize(entity.location ?? ""))
        : 0;

      let score = nameOverlap * 0.60 + aliasOverlap * 0.15 + locationOverlap * 0.25;

      if (canonicalExact) {
        score = Math.max(score, input.location && entity.location ? (overlap(requestedLocation, tokenize(entity.location)) === 1 ? 1 : 0.90) : 0.95);
        signals.push("canonical-name-exact");
      }
      if (aliasExact) {
        score = Math.max(score, 0.90);
        signals.push("alias-exact");
      }
      if (nameOverlap >= 0.75) signals.push("name-token-overlap");
      if (locationOverlap >= 0.80) signals.push("location-match");
      if (aliasOverlap >= 0.60) signals.push("alias-overlap");

      const rounded = Math.round(score * 1000) / 1000;
      const band: ReieMatchBand =
        rounded >= 0.98 ? "EXACT" :
        rounded >= 0.80 ? "STRONG" :
        rounded >= 0.55 ? "REVIEW" : "WEAK";

      return { entityId: entity.entityId, score: rounded, band, matchedSignals: [...new Set(signals)].sort() };
    })
    .sort((a, b) => b.score - a.score || a.entityId.localeCompare(b.entityId));
}
