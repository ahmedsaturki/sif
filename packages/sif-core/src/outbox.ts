import { appendFileSync, existsSync, mkdirSync, readFileSync, openSync, fsyncSync, closeSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { EventEnvelope, EventStore } from "./types.js";
import { digest, cryptoRandomId, now } from "./core.js";

export interface OutboxItem {
  outboxId: string;
  eventId: string;
  destination: string;
  payloadDigest: string;
  createdAt: string;
  attempts: number;
  deliveredAt?: string;
  leasedUntil?: string;
  lastError?: string;
}

export class InMemoryOutbox {
  private readonly items = new Map<string, OutboxItem>();
  enqueue(event: EventEnvelope, destination: string): OutboxItem {
    const key = `${event.eventId}:${destination}`;
    const existing = this.items.get(key);
    if (existing) return structuredClone(existing);
    const item: OutboxItem = { outboxId: cryptoRandomId(), eventId: event.eventId, destination, payloadDigest: digest(event.payload), createdAt: now(), attempts: 0 };
    this.items.set(key, item);
    return structuredClone(item);
  }
  pending(): OutboxItem[] { return [...this.items.values()].filter(i => !i.deliveredAt).map(i => structuredClone(i)); }
  markAttempt(outboxId: string): void { const found = [...this.items.values()].find(i => i.outboxId === outboxId); if (found) found.attempts += 1; }
  markDelivered(outboxId: string, at = now()): void { const found = [...this.items.values()].find(i => i.outboxId === outboxId); if (found) found.deliveredAt = at; }
}

export interface OutboxTransport { send(item: OutboxItem): void; }

export class OutboxDispatcher {
  constructor(private readonly outbox: InMemoryOutbox, private readonly transport: OutboxTransport) {}
  dispatchOnce(): number {
    let count = 0;
    for (const item of this.outbox.pending()) {
      this.outbox.markAttempt(item.outboxId);
      try { this.transport.send(item); this.outbox.markDelivered(item.outboxId); count += 1; }
      catch { /* retry remains pending */ }
    }
    return count;
  }
}

export function enqueueEvents(events: EventEnvelope[], outbox: InMemoryOutbox, destination: string): OutboxItem[] {
  return events.map(event => outbox.enqueue(event, destination));
}

export class PersistentJsonlOutbox {
  private readonly items = new Map<string, OutboxItem>();

  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.load();
  }

  private key(item: Pick<OutboxItem, "eventId" | "destination">): string { return `${item.eventId}:${item.destination}`; }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    const text = readFileSync(this.filePath, "utf8");
    for (const [index, line] of text.split("\n").entries()) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line) as OutboxItem;
        this.items.set(this.key(item), item);
      } catch { throw new Error(`Invalid outbox JSON at line ${index + 1}`); }
    }
  }

  private append(item: OutboxItem): void {
    const fd = openSync(this.filePath, "a");
    try { appendFileSync(fd, `${JSON.stringify(item)}\n`, "utf8"); fsyncSync(fd); }
    finally { closeSync(fd); }
  }

  enqueue(event: EventEnvelope, destination: string): OutboxItem {
    const key = `${event.eventId}:${destination}`;
    const existing = this.items.get(key);
    if (existing) return structuredClone(existing);
    const item: OutboxItem = { outboxId: cryptoRandomId(), eventId: event.eventId, destination, payloadDigest: digest(event.payload), createdAt: now(), attempts: 0 };
    this.items.set(key, item);
    this.append(item);
    return structuredClone(item);
  }

  pending(): OutboxItem[] { return [...this.items.values()].filter(i => !i.deliveredAt).map(i => structuredClone(i)); }

  private persistState(): void {
    const tmp = `${this.filePath}.compact`;
    const lines = [...this.items.values()].map(i => JSON.stringify(i)).join("\n") + (this.items.size ? "\n" : "");
    writeFileSync(tmp, lines, "utf8");
    const fd = openSync(tmp, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp, this.filePath);
  }

  markAttempt(outboxId: string): void {
    const found = [...this.items.values()].find(i => i.outboxId === outboxId);
    if (found) { found.attempts += 1; this.persistState(); }
  }

  markDelivered(outboxId: string, at = now()): void {
    const found = [...this.items.values()].find(i => i.outboxId === outboxId);
    if (found) { found.deliveredAt = at; delete found.leasedUntil; delete found.lastError; this.persistState(); }
  }
}

export function streamSince(store: EventStore, streamId: string, versionExclusive: number): EventEnvelope[] {
  return store.read(streamId, versionExclusive + 1);
}
