import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ReieSourceArtifactStore, ReieSourceArtifactError } from "../src/source-artifacts.ts";

const NOW = "2026-09-18T12:00:00.000Z";

test("ART-001 stores and verifies raw source content", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reie-art-"));
  try {
    const store = new ReieSourceArtifactStore(dir);
    const saved = await store.put({
      sourceId: "s1",
      observedAt: NOW,
      mediaType: "text/plain",
      content: "Galaxy Mall | Sadat City",
    });
    const loaded = await store.get("s1");
    assert.equal(loaded.contentDigest, saved.contentDigest);
    assert.equal(loaded.content, "Galaxy Mall | Sadat City");
    assert.deepEqual(await store.listSourceIds(), ["s1"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ART-002 rejects a digest mismatch", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reie-art-"));
  try {
    const store = new ReieSourceArtifactStore(dir);
    await assert.rejects(
      () => store.put({
        sourceId: "s1",
        observedAt: NOW,
        mediaType: "text/plain",
        content: "original",
        contentDigest: "bad",
      }),
      (error: unknown) => error instanceof ReieSourceArtifactError && error.code === "CORRUPT",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ART-003 enforces the byte limit before write", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reie-art-"));
  try {
    const store = new ReieSourceArtifactStore(dir, { maxBytes: 3 });
    await assert.rejects(
      () => store.put({
        sourceId: "s1",
        observedAt: NOW,
        mediaType: "text/plain",
        content: "abcd",
      }),
      (error: unknown) => error instanceof ReieSourceArtifactError && error.code === "TOO_LARGE",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ART-004 detects on-disk tampering", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reie-art-"));
  try {
    const store = new ReieSourceArtifactStore(dir);
    await store.put({
      sourceId: "s1",
      observedAt: NOW,
      mediaType: "text/plain",
      content: "original",
    });
    const files = await import("node:fs/promises").then((fs) => fs.readdir(dir));
    const path = join(dir, files[0]!);
    const raw = JSON.parse(await readFile(path, "utf8")) as { content: string };
    raw.content = "tampered";
    await writeFile(path, JSON.stringify(raw), "utf8");
    await assert.rejects(
      () => store.get("s1"),
      (error: unknown) => error instanceof ReieSourceArtifactError && error.code === "CORRUPT",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
