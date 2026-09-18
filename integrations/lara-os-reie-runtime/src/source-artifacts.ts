import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "./deterministic.js";

export interface ReieSourceArtifact {
  readonly sourceId: string;
  readonly uri?: string;
  readonly title?: string;
  readonly publisher?: string;
  readonly observedAt: string;
  readonly mediaType: "text/plain" | "application/json" | "text/csv";
  readonly contentDigest: string;
  readonly content: string;
}

export interface ReieSourceArtifactStoreOptions {
  readonly maxBytes?: number;
}

export class ReieSourceArtifactError extends Error {
  constructor(
    readonly code: "INVALID_INPUT" | "NOT_FOUND" | "TOO_LARGE" | "CORRUPT" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "ReieSourceArtifactError";
  }
}

export class ReieSourceArtifactStore {
  readonly maxBytes: number;

  constructor(
    readonly directory: string,
    options: ReieSourceArtifactStoreOptions = {},
  ) {
    this.maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
    if (!directory.trim()) throw new ReieSourceArtifactError("INVALID_INPUT", "Artifact directory must not be empty");
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes <= 0) {
      throw new ReieSourceArtifactError("INVALID_INPUT", "maxBytes must be positive");
    }
  }

  async put(input: Omit<ReieSourceArtifact, "contentDigest"> & { contentDigest?: string }): Promise<ReieSourceArtifact> {
    const sourceId = input.sourceId.trim();
    if (!sourceId) throw new ReieSourceArtifactError("INVALID_INPUT", "sourceId must not be empty");
    if (!Number.isFinite(Date.parse(input.observedAt))) {
      throw new ReieSourceArtifactError("INVALID_INPUT", "observedAt must be a valid timestamp");
    }
    if (!["text/plain", "application/json", "text/csv"].includes(input.mediaType)) {
      throw new ReieSourceArtifactError("INVALID_INPUT", "Unsupported artifact mediaType");
    }

    const content = input.content;
    const bytes = new TextEncoder().encode(content).byteLength;
    if (bytes > this.maxBytes) {
      throw new ReieSourceArtifactError("TOO_LARGE", "Source artifact exceeds byte limit");
    }
    const contentDigest = sha256(content);
    try {
      const existing = await this.get(sourceId);
      if (existing.contentDigest !== contentDigest) {
        throw new ReieSourceArtifactError("CONFLICT", "Source artifact already exists with different content");
      }
      return existing;
    } catch (error) {
      if (!(error instanceof ReieSourceArtifactError) || !["NOT_FOUND"].includes(error.code)) throw error;
    }
    if (input.contentDigest && input.contentDigest !== contentDigest) {
      throw new ReieSourceArtifactError("CORRUPT", "Provided contentDigest does not match content");
    }

    const artifact: ReieSourceArtifact = {
      sourceId,
      ...(input.uri?.trim() ? { uri: input.uri.trim() } : {}),
      ...(input.title?.trim() ? { title: input.title.trim() } : {}),
      ...(input.publisher?.trim() ? { publisher: input.publisher.trim() } : {}),
      observedAt: new Date(Date.parse(input.observedAt)).toISOString(),
      mediaType: input.mediaType,
      contentDigest,
      content,
    };

    await mkdir(this.directory, { recursive: true });
    const path = this.pathFor(sourceId);
    const temp = path + ".tmp";
    await writeFile(temp, JSON.stringify(artifact, null, 2) + "\n", "utf8");
    await rename(temp, path);
    return structuredClone(artifact);
  }

  async get(sourceId: string): Promise<ReieSourceArtifact> {
    const id = sourceId.trim();
    if (!id) throw new ReieSourceArtifactError("INVALID_INPUT", "sourceId must not be empty");
    let raw: string;
    try { raw = await readFile(this.pathFor(id), "utf8"); }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
      if (code === "ENOENT") throw new ReieSourceArtifactError("NOT_FOUND", "Source artifact not found");
      throw error;
    }

    let artifact: ReieSourceArtifact;
    try { artifact = JSON.parse(raw) as ReieSourceArtifact; }
    catch { throw new ReieSourceArtifactError("CORRUPT", "Source artifact JSON is invalid"); }
    if (artifact.sourceId !== id || sha256(artifact.content) !== artifact.contentDigest) {
      throw new ReieSourceArtifactError("CORRUPT", "Source artifact digest verification failed");
    }
    return structuredClone(artifact);
  }

  async listSourceIds(): Promise<string[]> {
    try {
      const names = await readdir(this.directory);
      const ids: string[] = [];
      for (const name of names.filter((value) => value.endsWith(".json")).sort()) {
        try {
          const artifact = JSON.parse(await readFile(join(this.directory, name), "utf8")) as ReieSourceArtifact;
          if (artifact.sourceId && sha256(artifact.content) === artifact.contentDigest) ids.push(artifact.sourceId);
        } catch {}
      }
      return ids.sort();
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
      if (code === "ENOENT") return [];
      throw error;
    }
  }

  private pathFor(sourceId: string): string {
    return join(this.directory, sha256(sourceId) + ".json");
  }
}
