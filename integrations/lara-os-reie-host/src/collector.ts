import { ReieSourceArtifactStore } from "../../lara-os-reie-runtime/dist/source-artifacts.js";
import {
  ReiePlaywrightBrowserWorker,
  type ReieBrowserSourceCapture,
} from "../../lara-os-reie-browser-worker/dist/worker.js";

export interface ReiePublicCollectionResult {
  readonly capture: ReieBrowserSourceCapture;
  readonly ingestion: unknown;
}

export class ReiePublicSourceCollector {
  constructor(
    private readonly browser: ReiePlaywrightBrowserWorker,
    private readonly workspace: {
      ingestDocument(document: {
        sourceId: string;
        uri: string;
        title: string;
        publisher?: string;
        observedAt: string;
        content: string;
        mediaType: "text/plain";
      }): Promise<unknown>;
    },
    private readonly artifacts?: ReieSourceArtifactStore,
  ) {}

  async collect(sourceId: string, uri: string): Promise<ReiePublicCollectionResult> {
    if (!sourceId.trim()) throw new Error("sourceId must not be empty");
    await this.browser.navigate(uri);
    const capture = await this.browser.captureCurrentPage(uri);
    const document = {
      sourceId,
      uri: capture.uri,
      title: capture.title,
      ...(capture.publisher ? { publisher: capture.publisher } : {}),
      observedAt: capture.observedAt,
      content: capture.content,
      mediaType: "text/plain" as const,
    };
    const ingestion = await this.workspace.ingestDocument(document);
    await this.artifacts?.put(document);
    return { capture, ingestion };
  }
}
