import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, fsyncSync, closeSync } from "node:fs";
import { dirname } from "node:path";
import type { AppendCondition, EventEnvelope, EventStore } from "./types.js";
import { ConcurrencyError, IntegrityError } from "./core.js";

export class PersistentJsonlEventStore implements EventStore {
  private readonly events: EventEnvelope<Record<string, unknown>>[] = [];
  private readonly versions = new Map<string, number>();

  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.load();
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    const content = readFileSync(this.filePath, "utf8");
    if (content.length === 0) return;
    for (const [index, line] of content.split("\n").entries()) {
      if (!line.trim()) continue;
      let event: EventEnvelope<Record<string, unknown>>;
      try { event = JSON.parse(line) as EventEnvelope<Record<string, unknown>>; }
      catch { throw new IntegrityError(`Invalid event JSON at line ${index + 1}`); }
      const current = this.streamVersion(event.streamId);
      if (event.streamVersion !== current + 1) throw new IntegrityError(`Non-contiguous stream at line ${index + 1}`);
      this.events.push(event);
      this.versions.set(event.streamId, event.streamVersion);
    }
  }

  append<T extends Record<string, unknown>>(event: EventEnvelope<T>, condition: AppendCondition): void {
    const current = this.streamVersion(event.streamId);
    if (current !== condition.expectedStreamVersion || event.streamVersion !== current + 1) {
      throw new ConcurrencyError(`Stream ${event.streamId} expected ${condition.expectedStreamVersion}; current=${current}; event=${event.streamVersion}`);
    }
    const line = `${JSON.stringify(event)}\n`;
    const fd = openSync(this.filePath, "a");
    try {
      appendFileSync(fd, line, "utf8");
      fsyncSync(fd);
    } finally { closeSync(fd); }
    this.events.push(structuredClone(event));
    this.versions.set(event.streamId, event.streamVersion);
  }

  read(streamId: string, fromVersion = 1): EventEnvelope<Record<string, unknown>>[] {
    return this.events.filter(e => e.streamId === streamId && e.streamVersion >= fromVersion).map(e => structuredClone(e));
  }

  all(): EventEnvelope<Record<string, unknown>>[] { return this.events.map(e => structuredClone(e)); }
  streamVersion(streamId: string): number { return this.versions.get(streamId) ?? 0; }

  compact(snapshotPath: string): void {
    const snapshot = JSON.stringify({ createdAt: new Date().toISOString(), events: this.events }, null, 2);
    mkdirSync(dirname(snapshotPath), { recursive: true });
    const tmp = `${snapshotPath}.tmp`;
    writeFileSync(tmp, snapshot, "utf8");
    renameSync(tmp, snapshotPath);
  }
}
