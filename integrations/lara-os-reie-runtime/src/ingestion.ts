import { canonicalJson, sha256 } from "./deterministic.js";
import {
  type ReieClaim,
  type ReieEntity,
  type ReieEntityType,
} from "./reie.js";
import { ReieWorkspace } from "./workspace.js";

export interface ReieIngestionDocument {
  readonly sourceId: string;
  readonly uri?: string;
  readonly title?: string;
  readonly publisher?: string;
  readonly observedAt: string;
  readonly content: string;
  readonly mediaType?: "text/plain" | "application/json" | "text/csv";
}

export interface ReieIngestionRecord {
  readonly recordId?: string;
  readonly entityId?: string;
  readonly entityType: ReieEntityType;
  readonly canonicalName: string;
  readonly location?: string;
  readonly aliases?: readonly string[];
  readonly claims?: readonly {
    readonly field: string;
    readonly value: unknown;
  }[];
}

export interface ReieCsvMapping {
  readonly entityType: string;
  readonly canonicalName: string;
  readonly location?: string;
  readonly aliases?: string;
  readonly claims?: Readonly<Record<string, string>>;
  readonly entityId?: string;
}

export interface ReieIngestionResult {
  readonly sourceId: string;
  readonly contentDigest: string;
  readonly entityIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly recordsAccepted: number;
  readonly recordsSkipped: number;
  readonly parseMode: "records" | "csv" | "source-only";
}

export class ReieIngestionError extends Error {
  constructor(
    readonly code: "INVALID_DOCUMENT" | "INVALID_RECORD" | "PARSE_ERROR" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "ReieIngestionError";
  }
}

const trimRequired = (name: string, value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new ReieIngestionError("INVALID_RECORD", name + " must not be empty");
  return trimmed;
};

const iso = (name: string, value: string): string => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new ReieIngestionError("INVALID_DOCUMENT", name + " must be a valid timestamp");
  return new Date(parsed).toISOString();
};

function parseJsonRecords(content: string): ReieIngestionRecord[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const records =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)
        ? (parsed as { records: unknown[] }).records
        : null;

  if (!records) return null;
  return records as ReieIngestionRecord[];
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]!;
    const next = content[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char === "\r") {
      if (next !== "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      }
    } else {
      cell += char;
    }
  }

  if (quoted) throw new ReieIngestionError("PARSE_ERROR", "CSV contains an unterminated quoted field");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((x) => x.some((cell) => cell.trim().length > 0));
}

const splitAliases = (value: string | undefined): string[] =>
  value
    ? [...new Set(value.split(/[;|]/u).map((x) => x.trim()).filter(Boolean))].sort()
    : [];

function rowToRecord(headers: string[], row: string[], mapping: ReieCsvMapping, rowIndex: number): ReieIngestionRecord {
  const values = new Map(headers.map((header, index) => [header, (row[index] ?? "").trim()]));
  const read = (column: string | undefined): string | undefined => {
    if (!column) return undefined;
    const value = values.get(column)?.trim();
    return value ? value : undefined;
  };

  const entityType = read(mapping.entityType) as ReieEntityType | undefined;
  const canonicalName = read(mapping.canonicalName);
  if (!entityType || !canonicalName) {
    throw new ReieIngestionError("INVALID_RECORD", `CSV row ${rowIndex}: entityType and canonicalName are required`);
  }

  const claims = Object.entries(mapping.claims ?? {})
    .map(([field, column]) => {
      const value = read(column);
      return value === undefined ? null : { field: trimRequired("claim field", field), value };
    })
    .filter((x): x is { field: string; value: unknown } => x !== null);

  return {
    recordId: "csv:" + rowIndex,
    ...(read(mapping.entityId) ? { entityId: read(mapping.entityId) } : {}),
    entityType,
    canonicalName,
    ...(read(mapping.location) ? { location: read(mapping.location) } : {}),
    aliases: splitAliases(read(mapping.aliases)),
    claims,
  };
}

function normalizeRecord(record: ReieIngestionRecord, sourceId: string, observedAt: string): ReieIngestionRecord {
  const entityType = trimRequired("entityType", record.entityType) as ReieEntityType;
  const canonicalName = trimRequired("canonicalName", record.canonicalName);
  const location = record.location?.trim();
  const aliases = [...new Set((record.aliases ?? []).map((alias) => trimRequired("alias", alias)))].sort();
  const claims = (record.claims ?? []).map((claim) => ({
    field: trimRequired("claim field", claim.field),
    value: structuredClone(claim.value),
  }));
  if (claims.some((claim) => claim.field === "")) {
    throw new ReieIngestionError("INVALID_RECORD", "Claim field must not be empty");
  }

  const generatedEntityId = "entity:" + sha256({ entityType, canonicalName, location: location ?? "" });
  return {
    ...(record.recordId ? { recordId: trimRequired("recordId", record.recordId) } : {}),
    entityId: record.entityId?.trim() || generatedEntityId,
    entityType,
    canonicalName,
    ...(location ? { location } : {}),
    aliases,
    claims,
  };
}

export async function ingestReieDocument(
  workspace: ReieWorkspace,
  document: ReieIngestionDocument,
  csvMapping?: ReieCsvMapping,
): Promise<ReieIngestionResult> {
  const sourceId = trimRequired("sourceId", document.sourceId);
  const observedAt = iso("observedAt", document.observedAt);
  const content = document.content;
  if (!content.length) throw new ReieIngestionError("INVALID_DOCUMENT", "content must not be empty");

  const contentDigest = sha256(content);
  const mediaType = document.mediaType ?? "text/plain";
  let records: ReieIngestionRecord[] = [];
  let parseMode: ReieIngestionResult["parseMode"] = "source-only";

  if (mediaType === "application/json") {
    records = parseJsonRecords(content) ?? [];
    if (!records.length) {
      throw new ReieIngestionError("PARSE_ERROR", "JSON source must be an array or an object containing records[]");
    }
    parseMode = "records";
  } else if (mediaType === "text/csv") {
    if (!csvMapping) throw new ReieIngestionError("PARSE_ERROR", "CSV ingestion requires an explicit column mapping");
    const rows = parseCsv(content);
    if (rows.length < 2) throw new ReieIngestionError("PARSE_ERROR", "CSV requires a header and at least one data row");
    const [headers, ...dataRows] = rows;
    const normalizedHeaders = headers!.map((x) => x.trim());
    if (normalizedHeaders.some((x) => !x)) throw new ReieIngestionError("PARSE_ERROR", "CSV headers must not be empty");
    records = dataRows.map((row, index) => rowToRecord(normalizedHeaders, row, csvMapping, index + 2));
    parseMode = "csv";
  } else {
    return {
      sourceId,
      contentDigest,
      entityIds: [],
      claimIds: [],
      recordsAccepted: 0,
      recordsSkipped: 0,
      parseMode,
    };
  }

  workspace.ingestSource({
    sourceId,
    ...(document.uri ? { uri: document.uri.trim() } : {}),
    ...(document.title ? { title: document.title.trim() } : {}),
    ...(document.publisher ? { publisher: document.publisher.trim() } : {}),
    observedAt,
    contentDigest,
  });

  const entityIds: string[] = [];
  const claimIds: string[] = [];
  let recordsAccepted = 0;

  for (const raw of records) {
    const record = normalizeRecord(raw, sourceId, observedAt);
    try {
      const entity: ReieEntity = {
        entityId: record.entityId!,
        entityType: record.entityType,
        canonicalName: record.canonicalName,
        ...(record.location ? { location: record.location } : {}),
        aliases: [...(record.aliases ?? [])],
      };
      workspace.upsertEntity(entity);
      entityIds.push(entity.entityId);

      for (const claim of record.claims ?? []) {
        const value = structuredClone(claim.value);
        const claimId = "claim:" + sha256({
          sourceId,
          entityId: entity.entityId,
          field: claim.field,
          value,
          observedAt,
        });
        const saved: ReieClaim = {
          claimId,
          entityId: entity.entityId,
          sourceId,
          field: claim.field,
          value,
          observedAt,
        };
        workspace.recordClaim(saved);
        claimIds.push(claimId);
      }
      recordsAccepted += 1;
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        throw new ReieIngestionError(
          error instanceof ReieIngestionError ? error.code : "CONFLICT",
          `Record ${record.recordId ?? record.entityId} rejected: ${error.message}`,
        );
      }
      throw error;
    }
  }

  return {
    sourceId,
    contentDigest,
    entityIds: [...new Set(entityIds)].sort(),
    claimIds: [...new Set(claimIds)].sort(),
    recordsAccepted,
    recordsSkipped,
    parseMode,
  };
}

export function canonicalIngestionRecord(record: ReieIngestionRecord): string {
  return canonicalJson(record);
}
