import { sha256 } from "./deterministic.js";
import type { ReieSource } from "./reie.js";

export interface ReiePublicFetchOptions {
  readonly url: string;
  readonly sourceId: string;
  readonly observedAt: string;
  readonly title?: string;
  readonly publisher?: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

export interface ReiePublicSourceDocument {
  readonly source: ReieSource;
  readonly contentType: string;
  readonly content: string;
}

export class ReiePublicFetchError extends Error {
  constructor(
    readonly code: "INVALID_URL" | "TIMEOUT" | "HTTP_ERROR" | "TOO_LARGE" | "UNSUPPORTED_CONTENT" | "FETCH_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "ReiePublicFetchError";
  }
}

export async function fetchPublicSource(
  options: ReiePublicFetchOptions,
): Promise<ReiePublicSourceDocument> {
  const url = new URL(options.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ReiePublicFetchError("INVALID_URL", "Only HTTP(S) public sources are allowed");
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 1_000_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new ReiePublicFetchError("INVALID_URL", "timeoutMs must be positive");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new ReiePublicFetchError("INVALID_URL", "maxBytes must be positive");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.5",
        "user-agent": "Lara-OS-REIE/1.0",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ReiePublicFetchError("TIMEOUT", "Public source fetch timed out");
    }
    throw new ReiePublicFetchError("FETCH_FAILED", String(error));
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ReiePublicFetchError("HTTP_ERROR", `Public source returned HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!/(text\/|application\/json|application\/xhtml\+xml)/i.test(contentType)) {
    throw new ReiePublicFetchError("UNSUPPORTED_CONTENT", "Only textual public sources are supported");
  }

  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader && Number.isFinite(Number(lengthHeader)) && Number(lengthHeader) > maxBytes) {
    throw new ReiePublicFetchError("TOO_LARGE", "Public source exceeds configured byte limit");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new ReiePublicFetchError("TOO_LARGE", "Public source exceeds configured byte limit");
  }
  const content = new TextDecoder().decode(bytes);

  return {
    source: {
      sourceId: options.sourceId,
      uri: url.toString(),
      ...(options.title ? { title: options.title.trim() } : {}),
      ...(options.publisher ? { publisher: options.publisher.trim() } : {}),
      observedAt: new Date(options.observedAt).toISOString(),
      contentDigest: sha256(content),
    },
    contentType,
    content,
  };
}
