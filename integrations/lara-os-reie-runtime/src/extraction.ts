import { sha256 } from "./deterministic.js";

export type ReieCandidateValueType = "string" | "number" | "boolean" | "json";

export interface ReieExtractionRule {
  readonly ruleId: string;
  readonly field: string;
  readonly pattern: RegExp;
  readonly valueType?: ReieCandidateValueType;
  readonly captureGroup?: number;
}

export interface ReieExtractionCandidate {
  readonly candidateId: string;
  readonly sourceId: string;
  readonly entityId: string;
  readonly field: string;
  readonly value: unknown;
  readonly evidenceText: string;
  readonly start: number;
  readonly end: number;
  readonly observedAt: string;
  readonly ruleId: string;
  readonly confidence: "REVIEW";
}

export class ReieExtractionError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "PARSE_ERROR", message: string) {
    super(message);
    this.name = "ReieExtractionError";
  }
}

function valueFromText(raw: string, type: ReieCandidateValueType | undefined): unknown {
  const value = raw.trim();
  if (!type || type === "string") return value;
  if (type === "number") {
    const parsed = Number(value.replace(/[,\s]/gu, ""));
    if (!Number.isFinite(parsed)) throw new ReieExtractionError("PARSE_ERROR", "Candidate value is not a finite number");
    return parsed;
  }
  if (type === "boolean") {
    const normalized = value.toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    throw new ReieExtractionError("PARSE_ERROR", "Candidate value is not boolean");
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new ReieExtractionError("PARSE_ERROR", "Candidate value is not valid JSON");
  }
}

export function extractReieTextCandidates(
  sourceId: string,
  entityId: string,
  content: string,
  observedAt: string,
  rules: readonly ReieExtractionRule[],
): ReieExtractionCandidate[] {
  if (!sourceId.trim() || !entityId.trim()) {
    throw new ReieExtractionError("INVALID_INPUT", "sourceId and entityId are required");
  }
  if (!content.length) throw new ReieExtractionError("INVALID_INPUT", "content must not be empty");
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new ReieExtractionError("INVALID_INPUT", "observedAt must be a valid timestamp");
  }

  const candidates: ReieExtractionCandidate[] = [];
  for (const rule of [...rules].sort((a, b) => a.ruleId.localeCompare(b.ruleId))) {
    if (!rule.ruleId.trim() || !rule.field.trim()) {
      throw new ReieExtractionError("INVALID_INPUT", "ruleId and field must not be empty");
    }
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g";
    if (rule.pattern.source.length > 1000) {
      throw new ReieExtractionError("INVALID_INPUT", "Extraction regex is too large");
    }
    const regex = new RegExp(rule.pattern.source, flags);
    let match: RegExpExecArray | null;
    let matchCount = 0;
    while ((match = regex.exec(content)) !== null) {
      matchCount += 1;
      if (matchCount > 1000) {
        throw new ReieExtractionError("INVALID_INPUT", "Extraction rule produced too many candidates");
      }
      if (match[0].length === 0) {
        regex.lastIndex = Math.min(content.length, match.index + 1);
        continue;
      }
      const group = rule.captureGroup ?? 1;
      const raw = (match[group] ?? match[0] ?? "").trim();
      if (!raw) continue;
      const start = match.index;
      const end = start + match[0].length;
      const value = valueFromText(raw, rule.valueType);
      candidates.push({
        candidateId: "candidate:" + sha256({
          sourceId,
          entityId,
          ruleId: rule.ruleId,
          field: rule.field,
          value,
          start,
          end,
        }),
        sourceId,
        entityId,
        field: rule.field,
        value,
        evidenceText: match[0],
        start,
        end,
        observedAt: new Date(Date.parse(observedAt)).toISOString(),
        ruleId: rule.ruleId,
        confidence: "REVIEW",
      });
      if (!rule.pattern.flags.includes("g")) break;
    }
  }

  return candidates.sort(
    (a, b) => a.start - b.start || a.field.localeCompare(b.field) || a.candidateId.localeCompare(b.candidateId),
  );
}
