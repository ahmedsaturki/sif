import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openReieWorkspace } from "../dist/persistence.js";
import { resolveEntityCandidates } from "../dist/resolution.js";
import { generateReieSignals } from "../dist/signals.js";
import type { ReieEntity } from "../reie.js";

const NOW = "2026-09-18T00:00:00.000Z";

async function tempJournal() {
  const dir = await mkdtemp(join(tmpdir(), "reie-"));
  return { dir, journal: join(dir, "data", "events.jsonl"), snapshot: join(dir, "data", "snapshot.json") };
}

test("REIE-LC001 persists and reloads a complete workspace", async () => {
  const t = await tempJournal();
  try {
    const first = await openReieWorkspace(t.journal);
    await first.ingestSource({ sourceId: "s1", observedAt: NOW, contentDigest: "d1" });
    await first.upsertEntity({ entityId: "p1", entityType: "property", canonicalName: "Galaxy Mall", location: "Sadat City", aliases: ["Galaxy"] });
    await first.recordClaim({ claimId: "c1", entityId: "p1", sourceId: "s1", field: "location", value: "Sadat City", observedAt: NOW });
    const second = await openReieWorkspace(t.journal);
    assert.deepEqual(second.counts(), { sources: 1, entities: 1, claims: 1, journalRecords: 3 });
    assert.deepEqual(second.workspace.knowledge("Galaxy Sadat"), {
      query: "galaxy sadat",
      entityIds: ["p1"],
      claimIds: ["c1"],
      sourceIds: ["s1"],
    });
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

test("REIE-LC003 persistent ingestion appends to the journal and reloads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reie-ingest-"));
  const journal = join(dir, "events.jsonl");
  try {
    const first = await openReieWorkspace(journal);
    const result = await first.ingestDocument({
      sourceId: "s1",
      observedAt: NOW,
      mediaType: "application/json",
      content: JSON.stringify({
        records: [{
          entityId: "p1",
          entityType: "property",
          canonicalName: "Galaxy Mall",
          location: "Sadat City",
          claims: [{ field: "propertyType", value: "mall" }]
        }]
      })
    });
    assert.equal(result.recordsAccepted, 1);
    assert.equal(first.counts().journalRecords, 3);

    const second = await openReieWorkspace(journal);
    assert.deepEqual(second.counts(), { sources: 1, entities: 1, claims: 1, journalRecords: 3 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("REIE-LC002 detects journal tampering", async () => {
  const t = await tempJournal();
  try {
    const db = await openReieWorkspace(t.journal);
    await db.ingestSource({ sourceId: "s1", observedAt: NOW, contentDigest: "d1" });
    const raw = await readFile(t.journal, "utf8");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(t.journal, raw.replace('"d1"', '"tampered"'), "utf8"));
    await assert.rejects(() => openReieWorkspace(t.journal), /Journal sequence or hash chain is invalid/);
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

test("REIE-LC004 exports and imports atomically", async () => {
  const t = await tempJournal();
  try {
    const first = await openReieWorkspace(t.journal);
    await first.ingestSource({ sourceId: "s1", observedAt: NOW, contentDigest: "d1" });
    await first.upsertEntity({ entityId: "p1", entityType: "property", canonicalName: "Galaxy Mall", location: "Sadat City", aliases: [] });
    await first.recordClaim({ claimId: "c1", entityId: "p1", sourceId: "s1", field: "propertyType", value: "mall", observedAt: NOW });
    await first.exportSnapshot(t.snapshot);
    const second = await openReieWorkspace(join(t.dir, "import.jsonl"));
    await second.importSnapshot(t.snapshot);
    assert.deepEqual(second.counts().entities, 1);
    assert.deepEqual(second.counts().claims, 1);
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

test("REIE-LC005 resolution returns candidates without merging", () => {
  const entities: ReieEntity[] = [
    { entityId: "p1", entityType: "property", canonicalName: "Galaxy Mall", location: "Sadat City", aliases: ["Galaxy"] },
    { entityId: "p2", entityType: "property", canonicalName: "Galaxy Residence", location: "Sadat City", aliases: [] },
  ];
  const result = resolveEntityCandidates({ entityType: "property", canonicalName: "Galaxy Mall", location: "Sadat City" }, entities);
  assert.equal(result[0]?.entityId, "p1");
  assert.equal(result[0]?.band, "EXACT");
  assert.equal(result.length, 2);
});

test("REIE-LC006 signal engine emits corroboration and missing-field signals", async () => {
  const t = await tempJournal();
  try {
    const db = await openReieWorkspace(t.journal);
    await db.ingestSource({ sourceId: "s1", observedAt: NOW, contentDigest: "d1" });
    await db.ingestSource({ sourceId: "s2", observedAt: NOW, contentDigest: "d2" });
    await db.upsertEntity({ entityId: "p1", entityType: "property", canonicalName: "Galaxy Mall", location: "Sadat City", aliases: [] });
    await db.recordClaim({ claimId: "c1", entityId: "p1", sourceId: "s1", field: "location", value: "Sadat City", observedAt: NOW });
    await db.recordClaim({ claimId: "c2", entityId: "p1", sourceId: "s2", field: "location", value: "Sadat City", observedAt: NOW });
    const snapshot = db.workspace.signals("p1", NOW);
    assert.equal(snapshot.sourceCount, 2);
    assert.equal(snapshot.signals.some((s) => s.kind === "MULTI_SOURCE_CORROBORATION"), true);
    assert.equal(snapshot.signals.some((s) => s.kind === "MISSING_CORE_FIELD"), true);
  } finally { await rm(t.dir, { recursive: true, force: true }); }
});

test("REIE-LC007 price-change signal is deterministic", () => {
  const entity: ReieEntity = { entityId: "p1", entityType: "property", canonicalName: "P", location: "S", aliases: [] };
  const signals = generateReieSignals(
    entity,
    [
      { claimId: "c1", entityId: "p1", sourceId: "s1", field: "price.amount", value: 100, observedAt: "2026-09-01T00:00:00.000Z" },
      { claimId: "c2", entityId: "p1", sourceId: "s2", field: "price.amount", value: 120, observedAt: NOW },
    ],
    [
      { sourceId: "s1", observedAt: "2026-09-01T00:00:00.000Z", contentDigest: "d1" },
      { sourceId: "s2", observedAt: NOW, contentDigest: "d2" },
    ],
    NOW,
    [],
  );
  assert.equal(signals.signals.some((s) => s.kind === "PRICE_CHANGE" && s.detail.includes("20")), true);
});
