export interface ReieSifInvocationLike {
  readonly requestId: string;
  readonly operation: string;
  readonly requestedCapabilities: readonly string[];
  readonly authorityScopes: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly payload: unknown;
  readonly correlationId: string;
  readonly requestedAt: string;
  readonly sourceSystem?: string;
}

export interface ReieSifResultLike {
  readonly response: {
    readonly status: string;
    readonly productId: string;
    readonly operation: string;
    readonly output?: unknown;
  };
  readonly evidence: unknown;
  readonly replayVerified: boolean;
}

export interface ReieSifBridgeLike {
  execute(input: ReieSifInvocationLike): Promise<ReieSifResultLike>;
}

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

export class ReieRuntimeError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT", message: string) {
    super(message);
    this.name = "ReieRuntimeError";
  }
}

const text = (name: string, value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new ReieRuntimeError("INVALID_INPUT", name + " must not be empty");
  return trimmed;
};

const iso = (name: string, value: string): string => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new ReieRuntimeError("INVALID_INPUT", name + " must be a valid timestamp");
  }
  return new Date(parsed).toISOString();
};

const stableTokens = (value: string): string[] =>
  [...new Set(value.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean))].sort();

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryReieStore {
  private readonly sources = new Map<string, ReieSource>();
  private readonly entities = new Map<string, ReieEntity>();
  private readonly claims = new Map<string, ReieClaim>();
  private readonly canonicalIndex = new Map<string, string>();

  addSource(input: ReieSource): ReieSource {
    const sourceId = text("sourceId", input.sourceId);
    const observedAt = iso("observedAt", input.observedAt);
    const contentDigest = text("contentDigest", input.contentDigest);
    if (this.sources.has(sourceId)) {
      const existing = this.sources.get(sourceId)!;
      if (!this.same(existing, { ...input, sourceId, observedAt, contentDigest })) {
        throw new ReieRuntimeError("CONFLICT", "Source already exists with different content");
      }
      return clone(existing);
    }
    const value: ReieSource = {
      sourceId,
      ...(input.uri ? { uri: input.uri.trim() } : {}),
      ...(input.title ? { title: input.title.trim() } : {}),
      ...(input.publisher ? { publisher: input.publisher.trim() } : {}),
      observedAt,
      contentDigest,
    };
    this.sources.set(sourceId, value);
    return clone(value);
  }

  upsertEntity(input: ReieEntity): ReieEntity {
    const entityId = text("entityId", input.entityId);
    const entityType = input.entityType;
    const canonicalName = text("canonicalName", input.canonicalName);
    const key = this.canonicalKey(entityType, canonicalName, input.location ?? "");
    const indexed = this.canonicalIndex.get(key);
    if (indexed && indexed !== entityId) {
      throw new ReieRuntimeError("CONFLICT", "Canonical entity already maps to " + indexed);
    }
    const value: ReieEntity = {
      entityId,
      entityType,
      canonicalName,
      ...(input.location ? { location: input.location.trim() } : {}),
      aliases: [...new Set(input.aliases.map((x) => text("alias", x)))].sort(),
    };
    this.entities.set(entityId, value);
    this.canonicalIndex.set(key, entityId);
    return clone(value);
  }

  addClaim(input: ReieClaim): ReieClaim {
    const claimId = text("claimId", input.claimId);
    const entityId = text("entityId", input.entityId);
    const sourceId = text("sourceId", input.sourceId);
    const field = text("field", input.field);
    const observedAt = iso("observedAt", input.observedAt);
    if (!this.entities.has(entityId)) throw new ReieRuntimeError("NOT_FOUND", "Entity not found");
    if (!this.sources.has(sourceId)) throw new ReieRuntimeError("NOT_FOUND", "Source not found");
    const value: ReieClaim = { claimId, entityId, sourceId, field, value: clone(input.value), observedAt };
    const existing = this.claims.get(claimId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(value)) {
      throw new ReieRuntimeError("CONFLICT", "Claim already exists with different value");
    }
    this.claims.set(claimId, value);
    return clone(value);
  }

  getEntity(entityId: string): ReieEntity {
    const value = this.entities.get(text("entityId", entityId));
    if (!value) throw new ReieRuntimeError("NOT_FOUND", "Entity not found");
    return clone(value);
  }

  knowledge(query: string): ReieKnowledgeResult {
    const q = stableTokens(text("query", query));
    const matchedEntities = [...this.entities.values()].filter((entity) => {
      const haystack = stableTokens([entity.canonicalName, entity.location ?? "", ...entity.aliases].join(" "));
      return q.every((token) => haystack.includes(token));
    });
    const entityIds = matchedEntities.map((x) => x.entityId).sort();
    const claimIds = [...this.claims.values()]
      .filter((claim) => entityIds.includes(claim.entityId))
      .map((x) => x.claimId)
      .sort();
    const sourceIds = [...this.claims.values()]
      .filter((claim) => entityIds.includes(claim.entityId))
      .map((x) => x.sourceId)
      .sort()
      .filter((id, index, all) => index === all.indexOf(id));
    return { query: q.join(" "), entityIds, claimIds, sourceIds };
  }

  evaluate(entityId: string): ReieEvaluation {
    const entity = this.getEntity(entityId);
    const claims = [...this.claims.values()].filter((claim) => claim.entityId === entity.entityId);
    const sources = new Set(claims.map((claim) => claim.sourceId));
    const fields = new Map<string, Set<string>>();
    for (const claim of claims) {
      const valueKey = JSON.stringify(clone(claim.value));
      const fieldSet = fields.get(claim.field) ?? new Set<string>();
      fieldSet.add(valueKey);
      fields.set(claim.field, fieldSet);
    }
    const corroboratedFields = [...fields.entries()]
      .filter(([, values]) => values.size === 1)
      .map(([field]) => field)
      .sort();
    const confidenceBand =
      claims.length >= 4 && sources.size >= 2 && corroboratedFields.length >= 2
        ? "HIGH"
        : claims.length >= 2 && sources.size >= 2
          ? "MEDIUM"
          : "LOW";
    return {
      entityId: entity.entityId,
      claimCount: claims.length,
      sourceCount: sources.size,
      corroboratedFields,
      confidenceBand,
    };
  }

  counts() {
    return {
      sources: this.sources.size,
      entities: this.entities.size,
      claims: this.claims.size,
    };
  }

  private canonicalKey(type: ReieEntityType, name: string, location: string): string {
    return [type, stableTokens(name).join(" "), stableTokens(location).join(" ")].join("|");
  }

  private same(a: ReieSource, b: ReieSource): boolean {
    return JSON.stringify(a) === JSON.stringify({
      sourceId: b.sourceId,
      ...(b.uri ? { uri: b.uri } : {}),
      ...(b.title ? { title: b.title } : {}),
      ...(b.publisher ? { publisher: b.publisher } : {}),
      observedAt: b.observedAt,
      contentDigest: b.contentDigest,
    });
  }
}

export class LaraOsReieRuntime {
  constructor(
    readonly store: InMemoryReieStore = new InMemoryReieStore(),
    readonly sif?: ReieSifBridgeLike,
  ) {}

  ingestSource(source: ReieSource): ReieSource {
    return this.store.addSource(source);
  }

  upsertEntity(entity: ReieEntity): ReieEntity {
    return this.store.upsertEntity(entity);
  }

  recordClaim(claim: ReieClaim): ReieClaim {
    return this.store.addClaim(claim);
  }

  knowledge(query: string): ReieKnowledgeResult {
    return this.store.knowledge(query);
  }

  evaluate(entityId: string): ReieEvaluation {
    return this.store.evaluate(entityId);
  }

  async policyCheck(
    payload: unknown,
    requestId: string,
    evidenceIds: readonly string[],
    requestedAt: string,
    correlationId = requestId,
  ): Promise<ReieSifResultLike> {
    return this.callSif(
      "policy.check",
      ["sif.policy.check"],
      ["product:lara:read"],
      payload,
      requestId,
      evidenceIds,
      requestedAt,
      correlationId,
    );
  }

  async knowledgeQuery(
    payload: unknown,
    requestId: string,
    evidenceIds: readonly string[],
    requestedAt: string,
    correlationId = requestId,
  ): Promise<ReieSifResultLike> {
    return this.callSif(
      "knowledge.query",
      ["sif.knowledge.query"],
      ["product:lara:read"],
      payload,
      requestId,
      evidenceIds,
      requestedAt,
      correlationId,
    );
  }

  async evaluationRun(
    payload: unknown,
    requestId: string,
    evidenceIds: readonly string[],
    requestedAt: string,
    correlationId = requestId,
  ): Promise<ReieSifResultLike> {
    return this.callSif(
      "evaluation.run",
      ["sif.evaluation.run"],
      ["product:lara:execute"],
      payload,
      requestId,
      evidenceIds,
      requestedAt,
      correlationId,
    );
  }

  private async callSif(
    operation: string,
    requestedCapabilities: readonly string[],
    authorityScopes: readonly string[],
    payload: unknown,
    requestId: string,
    evidenceIds: readonly string[],
    requestedAt: string,
    correlationId: string,
  ): Promise<ReieSifResultLike> {
    if (!this.sif) throw new ReieRuntimeError("NOT_FOUND", "SIF bridge is not configured");
    text("requestId", requestId);
    iso("requestedAt", requestedAt);
    return this.sif.execute({
      requestId,
      operation,
      requestedCapabilities,
      authorityScopes,
      evidenceIds,
      payload: clone(payload),
      correlationId: text("correlationId", correlationId),
      requestedAt,
      sourceSystem: "lara-os-reie",
    });
  }
}
