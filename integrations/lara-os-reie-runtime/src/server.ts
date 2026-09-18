import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { openReieWorkspace, type PersistentReieWorkspace } from "./persistence.js";
import { ReieReviewQueue } from "./review.js";
import { extractReieTextCandidates, type ReieExtractionRule } from "./extraction.js";

export interface ReieLocalServerOptions {
  readonly journalPath: string;
  readonly host?: "127.0.0.1";
  readonly port?: number;
  readonly maxBodyBytes?: number;
  readonly reviews?: ReieReviewQueue;
}

export class ReieLocalServer {
  private server: Server | undefined;
  private persistent: PersistentReieWorkspace | undefined;
  private readonly options: Required<Pick<ReieLocalServerOptions, "host" | "port" | "maxBodyBytes">>;
  readonly reviews: ReieReviewQueue;
  private readonly optionsJournalPath: string;

  constructor(options: ReieLocalServerOptions) {
    this.options = {
      host: options.host ?? "127.0.0.1",
      port: options.port ?? 8787,
      maxBodyBytes: options.maxBodyBytes ?? 256 * 1024,
    };
    if (this.options.maxBodyBytes <= 0) throw new Error("maxBodyBytes must be positive");
    this.reviews = options.reviews ?? new ReieReviewQueue();
    if (!options.journalPath.trim()) throw new Error("journalPath must not be empty");
    this.optionsJournalPath = options.journalPath;
  }

  async start(): Promise<{ host: string; port: number }> {
    if (this.server) throw new Error("REIE server is already running");
    this.persistent = await openReieWorkspace(this.optionsJournalPath);
    this.server = createServer((req, res) => {
      void this.handle(req, res).catch((error) => this.writeError(res, 500, error));
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(this.options.port, this.options.host, () => resolve());
    });
    const address = this.server.address();
    const port = typeof address === "object" && address ? address.port : this.options.port;
    return { host: this.options.host, port };
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => this.server!.close((error) => error ? reject(error) : resolve()));
    this.server = undefined;
    this.persistent = undefined;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const method = (req.method ?? "GET").toUpperCase();

    if (method === "GET" && url.pathname === "/health") {
      return this.writeJson(res, 200, { ok: true, ...(this.persistent?.counts() ?? {}) });
    }

    if (!this.persistent) return this.writeError(res, 503, "REIE server is not initialized");

    if (method === "GET" && url.pathname === "/knowledge") {
      const q = url.searchParams.get("q") ?? "";
      return this.writeJson(res, 200, this.persistent.workspace.knowledge(q));
    }

    if (method === "GET" && url.pathname === "/opportunities") {
      return this.writeJson(res, 200, this.persistent.opportunities(url.searchParams.get("asOf") ?? new Date().toISOString()));
    }

    if (method === "GET" && url.pathname === "/reviews") {
      return this.writeJson(res, 200, this.reviews.list());
    }

    if (method === "POST" && url.pathname === "/extract") {
      const body = await this.readJson(req);
      const rules = body.rules as ReieExtractionRule[];
      const candidates = extractReieTextCandidates(
        String(body.sourceId ?? ""),
        String(body.entityId ?? ""),
        String(body.content ?? ""),
        String(body.observedAt ?? new Date().toISOString()),
        rules,
      );
      const items = candidates.map((candidate) => this.reviews.add(candidate));
      return this.writeJson(res, 200, { candidates, reviewItems: items });
    }

    if (method === "POST" && url.pathname.startsWith("/reviews/")) {
      const candidateId = decodeURIComponent(url.pathname.slice("/reviews/".length));
      const body = await this.readJson(req);
      const item = await this.reviews.decide(candidateId, body.decision, String(body.reviewer ?? ""), this.persistent.workspace, String(body.reviewedAt ?? new Date().toISOString()));
      return this.writeJson(res, 200, item);
    }

    if (method === "POST" && url.pathname === "/ingest") {
      const body = await this.readJson(req);
      const result = await this.persistent.ingestDocument(body.document, body.csvMapping);
      return this.writeJson(res, 200, result);
    }

    return this.writeJson(res, 404, { error: "Not found" });
  }

  private async readJson(req: IncomingMessage): Promise<any> {
    let size = 0;
    const chunks: string[] = [];
    return await new Promise((resolve, reject) => {
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        size += new TextEncoder().encode(String(chunk)).byteLength;
        if (size > this.options.maxBodyBytes) {
          reject(new Error("Request body exceeds byte limit"));
          req.destroy();
          return;
        }
        chunks.push(String(chunk));
      });
      req.on("end", () => {
        try { resolve(JSON.parse(chunks.join(""))); }
        catch { reject(new Error("Request body must be valid JSON")); }
      });
      req.on("error", reject);
    });
  }

  private writeJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body) + "\n");
  }

  private writeError(res: ServerResponse, status: number, error: unknown): void {
    this.writeJson(res, status, { error: error instanceof Error ? error.message : String(error) });
  }
}
