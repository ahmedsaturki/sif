import {
  type ReieClaim,
  type ReieEntity,
  type ReieKnowledgeResult,
  type ReieSource,
  type ReieEvaluation,
  LaraOsReieRuntime,
  InMemoryReieStore,
} from "./reie.js";
import { resolveEntityCandidates, type ReieResolutionCandidate, type ReieResolutionInput } from "./resolution.js";
import { generateReieSignals, type ReieSignalSnapshot } from "./signals.js";
import { deepClone } from "./deterministic.js";

export interface ReieWorkspaceState {
  readonly sources: readonly ReieSource[];
  readonly entities: readonly ReieEntity[];
  readonly claims: readonly ReieClaim[];
}

export class ReieWorkspace {
  readonly runtime: LaraOsReieRuntime;
  private readonly sourceMap = new Map<string, ReieSource>();
  private readonly entityMap = new Map<string, ReieEntity>();
  private readonly claimMap = new Map<string, ReieClaim>();

  constructor() {
    this.runtime = new LaraOsReieRuntime(new InMemoryReieStore());
  }

  ingestSource(source: ReieSource): ReieSource {
    const saved = this.runtime.ingestSource(source);
    this.sourceMap.set(saved.sourceId, saved);
    return deepClone(saved);
  }

  upsertEntity(entity: ReieEntity): ReieEntity {
    const saved = this.runtime.upsertEntity(entity);
    this.entityMap.set(saved.entityId, saved);
    return deepClone(saved);
  }

  recordClaim(claim: ReieClaim): ReieClaim {
    const saved = this.runtime.recordClaim(claim);
    this.claimMap.set(saved.claimId, saved);
    return deepClone(saved);
  }

  getState(): ReieWorkspaceState {
    return {
      sources: [...this.sourceMap.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).map(deepClone),
      entities: [...this.entityMap.values()].sort((a, b) => a.entityId.localeCompare(b.entityId)).map(deepClone),
      claims: [...this.claimMap.values()].sort((a, b) => a.claimId.localeCompare(b.claimId)).map(deepClone),
    };
  }

  restore(state: ReieWorkspaceState): void {
    for (const source of [...state.sources].sort((a, b) => a.sourceId.localeCompare(b.sourceId))) this.ingestSource(source);
    for (const entity of [...state.entities].sort((a, b) => a.entityId.localeCompare(b.entityId))) this.upsertEntity(entity);
    for (const claim of [...state.claims].sort((a, b) => a.claimId.localeCompare(b.claimId))) this.recordClaim(claim);
  }

  knowledge(query: string): ReieKnowledgeResult {
    return this.runtime.knowledge(query);
  }

  evaluate(entityId: string): ReieEvaluation {
    return this.runtime.evaluate(entityId);
  }

  resolve(input: ReieResolutionInput): ReieResolutionCandidate[] {
    return resolveEntityCandidates(input, [...this.entityMap.values()]);
  }

  signals(entityId: string, asOf: string, coreFields?: readonly string[]): ReieSignalSnapshot {
    const entity = this.entityMap.get(entityId);
    if (!entity) throw new Error("Entity not found: " + entityId);
    return generateReieSignals(
      entity,
      [...this.claimMap.values()],
      [...this.sourceMap.values()],
      asOf,
      [...(coreFields ?? ["price.amount", "location", "propertyType"])],
    );
  }
}
