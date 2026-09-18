import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { openReieWorkspace, type PersistentReieWorkspace } from "./persistence.js";
import { ReieOperationalStore } from "./operational-persistence.js";
import { extractReieTextCandidates, type ReieExtractionRule, type ReieCandidateValueType } from "./extraction.js";
import { ReieAgentOrchestrator, createReieContentAgent, createReieQaAgent, createReieResearchAgent, createReieStrategyAgent, type ReieGovernanceGate } from "./agents.js";

export interface ReieLocalServerOptions {
  readonly journalPath: string;
  readonly host?: "127.0.0.1";
  readonly port?: number;
  readonly maxBodyBytes?: number;
  readonly operationalPath?: string;
  readonly governance?: ReieGovernanceGate;
}

export class ReieLocalServer {
  private server: Server | undefined;
  private persistent: PersistentReieWorkspace | undefined;
  private readonly options: Required<Pick<ReieLocalServerOptions, "host" | "port" | "maxBodyBytes">>;
  readonly operational: ReieOperationalStore;
  private readonly optionsJournalPath: string;
  private readonly orchestrator: ReieAgentOrchestrator;

  constructor(options: ReieLocalServerOptions) {
    this.options = {
      host: options.host ?? "127.0.0.1",
      port: options.port ?? 8787,
      maxBodyBytes: options.maxBodyBytes ?? 256 * 1024,
    };
    if (this.options.maxBodyBytes <= 0) throw new Error("maxBodyBytes must be positive");
    if (!options.journalPath.trim()) throw new Error("journalPath must not be empty");
    this.optionsJournalPath = options.journalPath;
    this.operational = new ReieOperationalStore(options.operationalPath ?? options.journalPath + ".ops.jsonl");
    this.orchestrator = new ReieAgentOrchestrator(options.governance);
  }

  async start(): Promise<{ host: string; port: number }> {
    if (this.server) throw new Error("REIE server is already running");
    this.persistent = await openReieWorkspace(this.optionsJournalPath);
    await this.operational.load();
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

    if (method === "GET" && url.pathname === "/") {
      return this.writeHtml(res, 200, dashboardHtml());
    }

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
      return this.writeJson(res, 200, this.operational.reviews.list());
    }

    if (method === "GET" && url.pathname === "/relations") {
      return this.writeJson(res, 200, this.operational.relations.listFor(url.searchParams.get("entityId") ?? undefined));
    }

    if (method === "GET" && url.pathname === "/agent-runs") {
      return this.writeJson(res, 200, this.operational.listAgentRuns());
    }


    if (method === "POST" && url.pathname === "/extract") {
      const body = await this.readJson(req);
      const rules = (Array.isArray(body.rules) ? body.rules : []).map((rule: {
        ruleId?: unknown;
        field?: unknown;
        pattern?: unknown;
        flags?: unknown;
        valueType?: unknown;
        captureGroup?: unknown;
      }): ReieExtractionRule => ({
        ruleId: String(rule.ruleId ?? ""),
        field: String(rule.field ?? ""),
        pattern: new RegExp(String(rule.pattern ?? ""), String(rule.flags ?? "")),
        ...(rule.valueType ? { valueType: String(rule.valueType) as ReieCandidateValueType } : {}),
        ...(rule.captureGroup !== undefined ? { captureGroup: Number(rule.captureGroup) } : {}),
      }));
      const candidates = extractReieTextCandidates(
        String(body.sourceId ?? ""),
        String(body.entityId ?? ""),
        String(body.content ?? ""),
        String(body.observedAt ?? new Date().toISOString()),
        rules,
      );
      const items = [];
      for (const candidate of candidates) items.push(await this.operational.addCandidate(candidate));
      return this.writeJson(res, 200, { candidates, reviewItems: items });
    }

    if (method === "POST" && url.pathname === "/relations") {
      const body = await this.readJson(req);
      const edge = await this.operational.addRelation(body);
      return this.writeJson(res, 200, edge);
    }

    if (method === "POST" && url.pathname.startsWith("/reviews/")) {
      const candidateId = decodeURIComponent(url.pathname.slice("/reviews/".length));
      const body = await this.readJson(req);
      const item = await this.operational.decide(candidateId, body.decision, String(body.reviewer ?? ""), this.persistent.workspace, String(body.reviewedAt ?? new Date().toISOString()));
      return this.writeJson(res, 200, item);
    }

    if (method === "POST" && url.pathname === "/agents/run") {
      const body = await this.readJson(req);
      const factories = {
        research: createReieResearchAgent,
        qa: createReieQaAgent,
        strategy: createReieStrategyAgent,
        content: createReieContentAgent,
      } as const;
      const requested = Array.isArray(body.agents) && body.agents.length ? body.agents : ["research", "qa", "strategy", "content"];
      const agents = requested.map((id: unknown) => {
        const factory = factories[String(id) as keyof typeof factories];
        if (!factory) throw new Error("Unknown agent: " + String(id));
        return factory();
      });
      const results = await this.orchestrator.run(agents, {
        workspace: this.persistent.workspace,
        asOf: String(body.asOf ?? new Date().toISOString()),
        input: body.input ?? null,
      });
      for (const result of results) await this.operational.recordAgentRun(result);
      return this.writeJson(res, 200, results);
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

  private writeHtml(res: ServerResponse, status: number, body: string): void {
    res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  }

  private writeJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body) + "\n");
  }

  private writeError(res: ServerResponse, status: number, error: unknown): void {
    this.writeJson(res, status, { error: error instanceof Error ? error.message : String(error) });
  }
}

function dashboardHtml(): string {
  return "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>REIE Local Intelligence Console</title>\n<style>body{font-family:system-ui,sans-serif;margin:0;background:#f5f7fa;color:#172033}.wrap{max-width:1180px;margin:auto;padding:24px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:white;border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin-top:12px}.value{font-size:24px;font-weight:700}.muted{color:#667085}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #eef0f3}@media(max-width:800px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:500px){.grid{grid-template-columns:1fr}}</style>\n</head><body><div class=\"wrap\"><h1>REIE Local Intelligence Console</h1><div class=\"muted\">Evidence-first local real-estate intelligence</div>\n<div id=\"stats\" class=\"grid\"></div><div class=\"card\"><h2>Research Opportunities</h2><div id=\"opps\">Loading...</div></div>\n<div class=\"card\"><h2>Review Queue</h2><div id=\"reviews\">Loading...</div></div><div class=\"card\"><h2>Relations</h2><div id=\"relations\">Loading...</div></div>\n<div class=\"card\"><h2>Agent Runs</h2><div id=\"agents\">Loading...</div></div></div>\n<script>\nasync function get(p){const r=await fetch(p);if(!r.ok)throw new Error(await r.text());return r.json()}\nfunction esc(v){return String(v==null?\"\":v).replace(/[&<>\"'\\\\]/g,function(c){return {\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",\"\\\"\":\"&quot;\",\"\\\\\":\"'\":\"&#39;\"}[c]})}\nfunction tbl(h,rows){if(!rows.length)return \"<div class=\\\"muted\\\">No records</div>\";return \"<table><thead><tr>\"+h.map(function(x){return \"<th>\"+esc(x)+\"</th>\"}).join(\"\")+\"</tr></thead><tbody>\"+rows.map(function(row){return \"<tr>\"+row.map(function(v){return \"<td>\"+esc(v)+\"</td>\"}).join(\"\")+\"</tr>\"}).join(\"\")+\"</tbody></table>\"}\nasync function load(){try{const d=await Promise.all([get(\"/health\"),get(\"/opportunities\"),get(\"/reviews\"),get(\"/relations\"),get(\"/agent-runs\")]);\ndocument.getElementById(\"stats\").innerHTML=d[0] ? [[\"Sources\",d[0].sources],[\"Entities\",d[0].entities],[\"Claims\",d[0].claims],[\"Journal\",d[0].journalRecords]].map(function(x){return \"<div class=\\\"card\\\"><div class=\\\"muted\\\">\"+esc(x[0])+\"</div><div class=\\\"value\\\">\"+esc(x[1])+\"</div></div>\"}).join(\"\") : \"\";\ndocument.getElementById(\"opps\").innerHTML=tbl([\"Entity\",\"Status\",\"Score\"],d[1].map(function(x){return [x.entityId,x.status,x.priority.score]}));\ndocument.getElementById(\"reviews\").innerHTML=tbl([\"Candidate\",\"Status\",\"Field\"],d[2].map(function(x){return [x.candidate.candidateId,x.status,x.candidate.field]}));\ndocument.getElementById(\"relations\").innerHTML=tbl([\"From\",\"Relation\",\"To\"],d[3].map(function(x){return [x.fromEntityId,x.relation,x.toEntityId]}));\ndocument.getElementById(\"agents\").innerHTML=tbl([\"Agent\",\"Status\",\"Run\"],d[4].map(function(x){return [x.agentId,x.status,x.runId]}));\n}catch(e){document.getElementById(\"stats\").innerHTML=\"<div class=\\\"card\\\">API error: \"+esc(e.message)+\"</div>\"}}load();setInterval(load,15000);\n</script></body></html>";
}
