import { sha256 } from "./deterministic.js";

export interface ReieRelationEdge {
  readonly relationId: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly relation: string;
  readonly sourceIds: readonly string[];
  readonly observedAt: string;
}

export class ReieRelationError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "CONFLICT", message: string) {
    super(message);
    this.name = "ReieRelationError";
  }
}

export class ReieRelationGraph {
  private readonly edges = new Map<string, ReieRelationEdge>();

  add(
    input: Omit<ReieRelationEdge, "relationId"> & { relationId?: string },
  ): ReieRelationEdge {
    const from = input.fromEntityId.trim();
    const to = input.toEntityId.trim();
    const relation = input.relation.trim();
    if (!from || !to || !relation) throw new ReieRelationError("INVALID_INPUT", "relation endpoints and relation are required");
    if (!Number.isFinite(Date.parse(input.observedAt))) throw new ReieRelationError("INVALID_INPUT", "observedAt must be valid");
    if (from === to) throw new ReieRelationError("INVALID_INPUT", "self relations are not allowed");

    const sourceIds = [...new Set(input.sourceIds.map((x) => x.trim()).filter(Boolean))].sort();
    if (!sourceIds.length) throw new ReieRelationError("INVALID_INPUT", "at least one sourceId is required");
    const relationId = input.relationId?.trim() || "relation:" + sha256({ from, to, relation, sourceIds, observedAt: new Date(Date.parse(input.observedAt)).toISOString() });
    const value: ReieRelationEdge = {
      relationId,
      fromEntityId: from,
      toEntityId: to,
      relation,
      sourceIds,
      observedAt: new Date(Date.parse(input.observedAt)).toISOString(),
    };
    const existing = this.edges.get(relationId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(value)) {
      throw new ReieRelationError("CONFLICT", "Relation already exists with different evidence");
    }
    this.edges.set(relationId, value);
    return structuredClone(value);
  }

  listFor(entityId?: string): ReieRelationEdge[] {
    const id = entityId?.trim();
    return [...this.edges.values()]
      .filter((edge) => !id || edge.fromEntityId === id || edge.toEntityId === id)
      .sort((a, b) => a.relationId.localeCompare(b.relationId))
      .map((edge) => structuredClone(edge));
  }

  export(): readonly ReieRelationEdge[] {
    return this.listFor();
  }

  restore(edges: readonly ReieRelationEdge[]): void {
    for (const edge of edges) this.add(edge);
  }
}
