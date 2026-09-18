import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, deepClone, sha256 } from "./deterministic.js";
import { ReieReviewQueue, type ReieReviewItem, type ReieClaimSink } from "./review.js";
import { ReieRelationGraph, type ReieRelationEdge } from "./relations.js";
import type { ReieExtractionCandidate } from "./extraction.js";
import type { ReieAgentRun } from "./agents.js";

export type ReieOperationalEventType = "review.upsert" | "relation.add" | "agent.run";

export interface ReieOperationalEvent {
  readonly sequence: number;
  readonly type: ReieOperationalEventType;
  readonly payload: ReieReviewItem | ReieRelationEdge | ReieAgentRun;
  readonly previousDigest: string | null;
  readonly recordDigest: string;
}

export interface ReieOperationalSnapshot {
  readonly schemaVersion: 1;
  readonly reviews: readonly ReieReviewItem[];
  readonly relations: readonly ReieRelationEdge[];
  readonly agentRuns: readonly ReieAgentRun[];
}

export class ReieOperationalPersistenceError extends Error {
  constructor(readonly code: "CORRUPT_JOURNAL" | "INVALID_SNAPSHOT" | "IO_ERROR", message: string) {
    super(message);
    this.name = "ReieOperationalPersistenceError";
  }
}

function digestOf(input: Omit<ReieOperationalEvent, "recordDigest">): string {
  return sha256(input);
}

export class ReieOperationalStore {
  readonly reviews = new ReieReviewQueue();
  readonly relations = new ReieRelationGraph();
  private readonly agentRunMap = new Map<string, ReieAgentRun>();
  private sequence = 0;
  private previousDigest: string | null = null;

  constructor(readonly path: string) {
    if (!path.trim()) throw new ReieOperationalPersistenceError("IO_ERROR", "Operational journal path must not be empty");
  }

  async load(): Promise<void> {
    try {
      await mkdir(dirname(this.path), { recursive: true });
      let raw = "";
      try { raw = await readFile(this.path, "utf8"); }
      catch (error) {
        const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
        if (code === "ENOENT") return;
        throw error;
      }
      for (const line of raw.split("\n").filter((value) => value.trim())) {
        let event: ReieOperationalEvent;
        try { event = JSON.parse(line) as ReieOperationalEvent; }
        catch { throw new ReieOperationalPersistenceError("CORRUPT_JOURNAL", "Invalid operational journal JSON"); }
        const expected = digestOf({
          sequence: event.sequence,
          type: event.type,
          payload: event.payload,
          previousDigest: event.previousDigest,
        });
        if (event.sequence !== this.sequence + 1 || event.previousDigest !== this.previousDigest || event.recordDigest !== expected) {
          throw new ReieOperationalPersistenceError("CORRUPT_JOURNAL", "Operational journal hash chain is invalid");
        }
        this.apply(event.type, event.payload);
        this.sequence = event.sequence;
        this.previousDigest = event.recordDigest;
      }
    } catch (error) {
      if (error instanceof ReieOperationalPersistenceError) throw error;
      throw new ReieOperationalPersistenceError("IO_ERROR", String(error));
    }
  }

  async addCandidate(candidate: ReieExtractionCandidate): Promise<ReieReviewItem> {
    const before = this.reviews.list().find((value) => value.candidate.candidateId === candidate.candidateId);
    const item = this.reviews.add(candidate);
    if (!before) await this.append("review.upsert", item);
    return item;
  }

  async decide(
    candidateId: string,
    decision: "ACCEPT" | "REJECT",
    reviewer: string,
    sink: ReieClaimSink,
    reviewedAt?: string,
  ): Promise<ReieReviewItem> {
    const before = this.reviews.list().find((value) => value.candidate.candidateId === candidateId.trim());
    const item = await this.reviews.decide(candidateId, decision, reviewer, sink, reviewedAt);
    if (!before || JSON.stringify(before) !== JSON.stringify(item)) {
      await this.append("review.upsert", item);
    }
    return item;
  }

  async addRelation(input: Omit<ReieRelationEdge, "relationId"> & { relationId?: string }): Promise<ReieRelationEdge> {
    const edge = this.relations.add(input);
    const existed = this.relations.listFor().some((value) => value.relationId === edge.relationId);
    if (!existed) await this.append("relation.add", edge);
    return edge;
  }

  async recordAgentRun(run: ReieAgentRun): Promise<ReieAgentRun> {
    const value = deepClone(run);
    const existing = this.agentRunMap.get(value.runId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(value)) {
        throw new ReieOperationalPersistenceError("IO_ERROR", "Agent run already exists with different content");
      }
      return deepClone(existing);
    }
    this.agentRunMap.set(value.runId, value);
    await this.append("agent.run", value);
    return value;
  }

  listAgentRuns(): ReieAgentRun[] {
    return [...this.agentRunMap.values()].sort((a, b) => a.runId.localeCompare(b.runId)).map(deepClone);
  }

  snapshot(): ReieOperationalSnapshot {
    return {
      schemaVersion: 1,
      reviews: this.reviews.export(),
      relations: this.relations.export(),
      agentRuns: this.listAgentRuns(),
    };
  }

  async exportSnapshot(path: string): Promise<ReieOperationalSnapshot> {
    const snapshot = this.snapshot();
    await mkdir(dirname(path), { recursive: true });
    const tmp = path + ".tmp";
    await writeFile(tmp, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    await rename(tmp, path);
    return deepClone(snapshot);
  }

  private async append(type: ReieOperationalEventType, payload: ReieOperationalEvent["payload"]): Promise<void> {
    const base: Omit<ReieOperationalEvent, "recordDigest"> = {
      sequence: this.sequence + 1,
      type,
      payload: deepClone(payload),
      previousDigest: this.previousDigest,
    };
    const event: ReieOperationalEvent = { ...base, recordDigest: digestOf(base) };
    try {
      await mkdir(dirname(this.path), { recursive: true });
      await appendFile(this.path, canonicalJson(event) + "\n", "utf8");
      this.sequence = event.sequence;
      this.previousDigest = event.recordDigest;
    } catch (error) {
      throw new ReieOperationalPersistenceError("IO_ERROR", String(error));
    }
  }

  private apply(type: ReieOperationalEventType, payload: ReieOperationalEvent["payload"]): void {
    if (type === "review.upsert") {
      const item = payload as ReieReviewItem;
      this.reviews.restore([item]);
      return;
    }
    if (type === "relation.add") {
      this.relations.restore([payload as ReieRelationEdge]);
      return;
    }
    const run = payload as ReieAgentRun;
    this.agentRunMap.set(run.runId, deepClone(run));
  }
}
