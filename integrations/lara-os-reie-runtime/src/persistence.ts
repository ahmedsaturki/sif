import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deepClone, canonicalJson, sha256 } from "./deterministic.js";
import { ReieWorkspace, type ReieWorkspaceState } from "./workspace.js";
import type { ReieClaim, ReieEntity, ReieSource } from "./reie.js";

export type ReieJournalType = "source.upsert" | "entity.upsert" | "claim.record";

export interface ReieJournalRecord {
  readonly sequence: number;
  readonly type: ReieJournalType;
  readonly payload: ReieSource | ReieEntity | ReieClaim;
  readonly previousDigest: string | null;
  readonly recordDigest: string;
}

export interface ReieSnapshot {
  readonly schemaVersion: 1;
  readonly sources: readonly ReieSource[];
  readonly entities: readonly ReieEntity[];
  readonly claims: readonly ReieClaim[];
}

export class ReiePersistenceError extends Error {
  constructor(readonly code: "CORRUPT_JOURNAL" | "INVALID_SNAPSHOT" | "IO_ERROR", message: string) {
    super(message);
    this.name = "ReiePersistenceError";
  }
}

function recordDigest(input: Omit<ReieJournalRecord, "recordDigest">): string {
  return sha256(input);
}

function typeOf(payload: ReieSource | ReieEntity | ReieClaim): ReieJournalType {
  if ("contentDigest" in payload) return "source.upsert";
  if ("entityType" in payload) return "entity.upsert";
  return "claim.record";
}

export async function openReieWorkspace(journalPath: string): Promise<PersistentReieWorkspace> {
  const workspace = new ReieWorkspace();
  const journal = new PersistentReieWorkspace(workspace, journalPath);
  await journal.load();
  return journal;
}

export class PersistentReieWorkspace {
  private sequence = 0;
  private previousDigest: string | null = null;

  constructor(readonly workspace: ReieWorkspace, readonly journalPath: string) {}

  async load(): Promise<void> {
    try {
      await mkdir(dirname(this.journalPath), { recursive: true });
      let raw = "";
      try { raw = await readFile(this.journalPath, "utf8"); }
      catch (error) {
        const code = error && typeof error === "object" && "code" in error
          ? (error as { code?: unknown }).code
          : undefined;
        if (code === "ENOENT") return;
        throw error;
      }
      const lines = raw.split("\n").filter((line) => line.trim().length > 0);
      for (const line of lines) {
        let record: ReieJournalRecord;
        try { record = JSON.parse(line) as ReieJournalRecord; }
        catch { throw new ReiePersistenceError("CORRUPT_JOURNAL", "Invalid JSON journal record"); }

        const expected = recordDigest({
          sequence: record.sequence,
          type: record.type,
          payload: record.payload,
          previousDigest: record.previousDigest,
        });
        if (record.sequence !== this.sequence + 1 || record.previousDigest !== this.previousDigest || record.recordDigest !== expected) {
          throw new ReiePersistenceError("CORRUPT_JOURNAL", "Journal sequence or hash chain is invalid at record " + record.sequence);
        }
        this.apply(record.type, record.payload);
        this.sequence = record.sequence;
        this.previousDigest = record.recordDigest;
      }
    } catch (error) {
      if (error instanceof ReiePersistenceError) throw error;
      throw new ReiePersistenceError("IO_ERROR", String(error));
    }
  }

  async ingestSource(source: ReieSource): Promise<ReieSource> {
    const saved = this.workspace.ingestSource(source);
    await this.append("source.upsert", saved);
    return saved;
  }

  async upsertEntity(entity: ReieEntity): Promise<ReieEntity> {
    const saved = this.workspace.upsertEntity(entity);
    await this.append("entity.upsert", saved);
    return saved;
  }

  async recordClaim(claim: ReieClaim): Promise<ReieClaim> {
    const saved = this.workspace.recordClaim(claim);
    await this.append("claim.record", saved);
    return saved;
  }

  async exportSnapshot(path: string): Promise<ReieSnapshot> {
    const state = this.workspace.getState();
    const snapshot: ReieSnapshot = {
      schemaVersion: 1,
      sources: state.sources,
      entities: state.entities,
      claims: state.claims,
    };
    const tmp = path + ".tmp";
    await mkdir(dirname(path), { recursive: true });
    await writeFile(tmp, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    await rename(tmp, path);
    return deepClone(snapshot);
  }

  async importSnapshot(snapshotPath: string): Promise<ReieSnapshot> {
    let snapshot: ReieSnapshot;
    try { snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as ReieSnapshot; }
    catch (error) { throw new ReiePersistenceError("INVALID_SNAPSHOT", String(error)); }
    if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.sources) || !Array.isArray(snapshot.entities) || !Array.isArray(snapshot.claims)) {
      throw new ReiePersistenceError("INVALID_SNAPSHOT", "Unsupported REIE snapshot");
    }
    for (const source of snapshot.sources) await this.ingestSource(source);
    for (const entity of snapshot.entities) await this.upsertEntity(entity);
    for (const claim of snapshot.claims) await this.recordClaim(claim);
    return deepClone(snapshot);
  }

  counts() {
    const state = this.workspace.getState();
    return { sources: state.sources.length, entities: state.entities.length, claims: state.claims.length, journalRecords: this.sequence };
  }

  private async append(type: ReieJournalType, payload: ReieJournalRecord["payload"]): Promise<void> {
    const base: Omit<ReieJournalRecord, "recordDigest"> = {
      sequence: this.sequence + 1,
      type,
      payload: deepClone(payload),
      previousDigest: this.previousDigest,
    };
    const record: ReieJournalRecord = { ...base, recordDigest: recordDigest(base) };
    try {
      await mkdir(dirname(this.journalPath), { recursive: true });
      await appendFile(this.journalPath, canonicalJson(record) + "\n", "utf8");
      this.sequence = record.sequence;
      this.previousDigest = record.recordDigest;
    } catch (error) {
      throw new ReiePersistenceError("IO_ERROR", String(error));
    }
  }

  private apply(type: ReieJournalType, payload: ReieJournalRecord["payload"]): void {
    if (type === "source.upsert") this.workspace.ingestSource(payload as ReieSource);
    else if (type === "entity.upsert") this.workspace.upsertEntity(payload as ReieEntity);
    else this.workspace.recordClaim(payload as ReieClaim);
  }
}
