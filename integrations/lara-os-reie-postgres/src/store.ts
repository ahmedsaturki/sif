import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool, type PoolConfig } from "pg";

export type ReieEntityType = "property" | "person" | "company" | "project" | "location" | "other";

export interface ReieSource {
  readonly sourceId: string;
  readonly uri?: string;
  readonly title?: string;
  readonly publisher?: string;
  readonly observedAt: string;
  readonly contentDigest: string;
}

export interface ReieEntity {
  readonly entityId: string;
  readonly entityType: ReieEntityType;
  readonly canonicalName: string;
  readonly location?: string;
  readonly aliases: readonly string[];
}

export interface ReieClaim {
  readonly claimId: string;
  readonly entityId: string;
  readonly sourceId: string;
  readonly field: string;
  readonly value: unknown;
  readonly observedAt: string;
}

export interface ReieKnowledgeResult {
  readonly query: string;
  readonly entityIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly sourceIds: readonly string[];
}

export interface ReieEvaluation {
  readonly entityId: string;
  readonly claimCount: number;
  readonly sourceCount: number;
  readonly corroboratedFields: readonly string[];
  readonly confidenceBand: "LOW" | "MEDIUM" | "HIGH";
}

export interface ReiePgClientLike {
  query<T extends object = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface ReiePgPoolLike extends ReiePgClientLike {
  connect(): Promise<ReiePgClientLike & { release?: () => void }>;
}

export class ReiePostgresError extends Error {
  constructor(
    readonly code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "DATABASE",
    message: string,
  ) {
    super(message);
    this.name = "ReiePostgresError";
  }
}

const ENTITY_TYPES: readonly ReieEntityType[] = [
  "property",
  "person",
  "company",
  "project",
  "location",
  "other",
];

function isEntityType(value: string): value is ReieEntityType {
  return ENTITY_TYPES.includes(value as ReieEntityType);
}

function tokens(value: string): string[] {
  return [...new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean))].sort();
}

function canonicalKey(type: ReieEntityType, name: string, location = ""): string {
  return [type, tokens(name).join(" "), tokens(location).join(" ")].join("|");
}

function text(name: string, value: string): string {
  const result = value.trim();
  if (!result) throw new ReiePostgresError("INVALID_INPUT", name + " must not be empty");
  return result;
}

function timestamp(name: string, value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new ReiePostgresError("INVALID_INPUT", name + " must be a valid timestamp");
  }
  return new Date(parsed).toISOString();
}

function rowSource(row: Record<string, unknown>): ReieSource {
  return {
    sourceId: String(row.source_id),
    ...(row.uri == null ? {} : { uri: String(row.uri) }),
    ...(row.title == null ? {} : { title: String(row.title) }),
    ...(row.publisher == null ? {} : { publisher: String(row.publisher) }),
    observedAt: new Date(String(row.observed_at)).toISOString(),
    contentDigest: String(row.content_digest),
  };
}

function rowEntity(row: Record<string, unknown>): ReieEntity {
  const entityType = String(row.entity_type);
  if (!isEntityType(entityType)) {
    throw new ReiePostgresError("DATABASE", "Stored entity has unsupported entityType: " + entityType);
  }
  const aliases = Array.isArray(row.aliases) ? row.aliases.map(String) : [];
  return {
    entityId: String(row.entity_id),
    entityType,
    canonicalName: String(row.canonical_name),
    ...(row.location == null ? {} : { location: String(row.location) }),
    aliases: [...new Set(aliases)].sort(),
  };
}

function rowClaim(row: Record<string, unknown>): ReieClaim {
  return {
    claimId: String(row.claim_id),
    entityId: String(row.entity_id),
    sourceId: String(row.source_id),
    field: String(row.field),
    value: structuredClone(row.value),
    observedAt: new Date(String(row.observed_at)).toISOString(),
  };
}

async function schemaSql(): Promise<string> {
  return readFile(fileURLToPath(new URL("../schema.sql", import.meta.url)), "utf8");
}

function normalizeError(error: unknown): ReiePostgresError {
  if (error instanceof ReiePostgresError) return error;
  const candidate = error as { code?: unknown; constraint?: unknown; message?: unknown } | null;
  if (candidate?.code === "23505") {
    return new ReiePostgresError(
      "CONFLICT",
      String(candidate.message ?? "PostgreSQL unique constraint violation"),
    );
  }
  if (candidate?.code === "23503") {
    return new ReiePostgresError(
      "NOT_FOUND",
      String(candidate.message ?? "Referenced REIE source or entity was not found"),
    );
  }
  return new ReiePostgresError("DATABASE", error instanceof Error ? error.message : String(error));
}

export class ReiePostgresStore {
  constructor(readonly pool: ReiePgPoolLike) {}

  static fromConfig(config: PoolConfig): ReiePostgresStore {
    return new ReiePostgresStore(new Pool(config) as unknown as ReiePgPoolLike);
  }

  async migrate(): Promise<void> {
    try {
      await this.pool.query(await schemaSql());
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async close(): Promise<void> {
    const pool = this.pool as unknown as { end?: () => Promise<void> };
    await pool.end?.();
  }

  async ingestSource(input: ReieSource): Promise<ReieSource> {
    const sourceId = text("sourceId", input.sourceId);
    const observedAt = timestamp("observedAt", input.observedAt);
    const contentDigest = text("contentDigest", input.contentDigest);
    const value: ReieSource = {
      sourceId,
      ...(input.uri?.trim() ? { uri: input.uri.trim() } : {}),
      ...(input.title?.trim() ? { title: input.title.trim() } : {}),
      ...(input.publisher?.trim() ? { publisher: input.publisher.trim() } : {}),
      observedAt,
      contentDigest,
    };

    try {
      const existing = await this.pool.query<Record<string, unknown>>(
        "SELECT source_id, uri, title, publisher, observed_at, content_digest FROM reie_sources WHERE source_id = $1",
        [sourceId],
      );
      if (existing.rows[0]) {
        const current = rowSource(existing.rows[0]);
        if (JSON.stringify(current) !== JSON.stringify(value)) {
          throw new ReiePostgresError("CONFLICT", "Source already exists with different content");
        }
        return structuredClone(current);
      }
      await this.pool.query(
        "INSERT INTO reie_sources (source_id, uri, title, publisher, observed_at, content_digest) VALUES ($1,$2,$3,$4,$5,$6)",
        [sourceId, value.uri ?? null, value.title ?? null, value.publisher ?? null, value.observedAt, value.contentDigest],
      );
      return structuredClone(value);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async upsertEntity(input: ReieEntity): Promise<ReieEntity> {
    const entityId = text("entityId", input.entityId);
    const canonicalName = text("canonicalName", input.canonicalName);
    if (!isEntityType(input.entityType)) {
      throw new ReiePostgresError("INVALID_INPUT", "Unsupported entityType");
    }
    const location = input.location?.trim();
    const key = canonicalKey(input.entityType, canonicalName, location ?? "");
    const aliases = [...new Set(input.aliases.map((alias) => text("alias", alias)))].sort();

    const tx = await this.pool.connect();
    try {
      await tx.query("BEGIN");

      const canonical = await tx.query<Record<string, unknown>>(
        "SELECT entity_id FROM reie_entities WHERE canonical_key = $1 FOR SHARE",
        [key],
      );
      const mapped = canonical.rows[0]?.entity_id;
      if (mapped && String(mapped) !== entityId) {
        throw new ReiePostgresError("CONFLICT", "Canonical entity already maps to " + String(mapped));
      }

      await tx.query(
        `INSERT INTO reie_entities (entity_id, entity_type, canonical_name, location, canonical_key, aliases)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (entity_id) DO UPDATE
         SET entity_type = EXCLUDED.entity_type,
             canonical_name = EXCLUDED.canonical_name,
             location = EXCLUDED.location,
             canonical_key = EXCLUDED.canonical_key,
             aliases = EXCLUDED.aliases`,
        [entityId, input.entityType, canonicalName, location ?? null, key, JSON.stringify(aliases)],
      );

      await tx.query("COMMIT");
      return {
        entityId,
        entityType: input.entityType,
        canonicalName,
        ...(location ? { location } : {}),
        aliases,
      };
    } catch (error) {
      try { await tx.query("ROLLBACK"); } catch {}
      throw normalizeError(error);
    } finally {
      tx.release?.();
    }
  }

  async recordClaim(input: ReieClaim): Promise<ReieClaim> {
    const claimId = text("claimId", input.claimId);
    const entityId = text("entityId", input.entityId);
    const sourceId = text("sourceId", input.sourceId);
    const field = text("field", input.field);
    const observedAt = timestamp("observedAt", input.observedAt);
    const value = structuredClone(input.value);

    try {
      const existing = await this.pool.query<Record<string, unknown>>(
        "SELECT claim_id, entity_id, source_id, field, value, observed_at FROM reie_claims WHERE claim_id = $1",
        [claimId],
      );
      if (existing.rows[0]) {
        const current = rowClaim(existing.rows[0]);
        if (JSON.stringify(current) !== JSON.stringify({ claimId, entityId, sourceId, field, value, observedAt })) {
          throw new ReiePostgresError("CONFLICT", "Claim already exists with different value");
        }
        return current;
      }
      await this.pool.query(
        "INSERT INTO reie_claims (claim_id, entity_id, source_id, field, value, observed_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)",
        [claimId, entityId, sourceId, field, JSON.stringify(value), observedAt],
      );
      return { claimId, entityId, sourceId, field, value, observedAt };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async getState(): Promise<{ sources: ReieSource[]; entities: ReieEntity[]; claims: ReieClaim[] }> {
    try {
      const [sources, entities, claims] = await Promise.all([
        this.pool.query<Record<string, unknown>>(
          "SELECT source_id, uri, title, publisher, observed_at, content_digest FROM reie_sources ORDER BY source_id",
        ),
        this.pool.query<Record<string, unknown>>(
          "SELECT entity_id, entity_type, canonical_name, location, aliases FROM reie_entities ORDER BY entity_id",
        ),
        this.pool.query<Record<string, unknown>>(
          "SELECT claim_id, entity_id, source_id, field, value, observed_at FROM reie_claims ORDER BY claim_id",
        ),
      ]);
      return {
        sources: sources.rows.map(rowSource),
        entities: entities.rows.map(rowEntity),
        claims: claims.rows.map(rowClaim),
      };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async knowledge(query: string): Promise<ReieKnowledgeResult> {
    const q = tokens(text("query", query));
    const state = await this.getState();
    const matchedEntities = state.entities.filter((entity) => {
      const haystack = tokens([entity.canonicalName, entity.location ?? "", ...entity.aliases].join(" "));
      return q.every((token) => haystack.includes(token));
    });
    const entityIds = matchedEntities.map((entity) => entity.entityId).sort();
    const claimIds = state.claims.filter((claim) => entityIds.includes(claim.entityId)).map((claim) => claim.claimId).sort();
    const sourceIds = [...new Set(
      state.claims.filter((claim) => entityIds.includes(claim.entityId)).map((claim) => claim.sourceId),
    )].sort();
    return { query: q.join(" "), entityIds, claimIds, sourceIds };
  }

  async evaluate(entityId: string): Promise<ReieEvaluation> {
    const id = text("entityId", entityId);
    const state = await this.getState();
    const entity = state.entities.find((item) => item.entityId === id);
    if (!entity) throw new ReiePostgresError("NOT_FOUND", "Entity not found");
    const claims = state.claims.filter((claim) => claim.entityId === id);
    const sources = new Set(claims.map((claim) => claim.sourceId));
    const values = new Map<string, Set<string>>();
    for (const claim of claims) {
      const set = values.get(claim.field) ?? new Set<string>();
      set.add(JSON.stringify(claim.value));
      values.set(claim.field, set);
    }
    const corroboratedFields = [...values.entries()]
      .filter(([, set]) => set.size === 1)
      .map(([field]) => field)
      .sort();
    const confidenceBand =
      claims.length >= 4 && sources.size >= 2 && corroboratedFields.length >= 2
        ? "HIGH"
        : claims.length >= 2 && sources.size >= 2
          ? "MEDIUM"
          : "LOW";
    return {
      entityId: id,
      claimCount: claims.length,
      sourceCount: sources.size,
      corroboratedFields,
      confidenceBand,
    };
  }
}
