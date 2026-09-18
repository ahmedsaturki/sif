import { chromium, type BrowserContext, type Page } from "playwright";

export interface ReieBrowserWorkerOptions {
  readonly userDataDir: string;
  readonly headless?: boolean;
  readonly timeoutMs?: number;
  readonly allowedHosts?: readonly string[];
}

export interface ReieBrowserSourceCapture {
  readonly uri: string;
  readonly title: string;
  readonly publisher?: string;
  readonly observedAt: string;
  readonly content: string;
  readonly mediaType: "text/plain";
}

export class ReieBrowserWorkerError extends Error {
  constructor(readonly code: "INVALID_URL" | "HOST_NOT_ALLOWED" | "BROWSER" | "TIMEOUT", message: string) {
    super(message);
    this.name = "ReieBrowserWorkerError";
  }
}

export class ReiePlaywrightBrowserWorker {
  private context: BrowserContext | undefined;
  private page: Page | undefined;

  constructor(private readonly options: ReieBrowserWorkerOptions) {
    if (!options.userDataDir.trim()) throw new ReieBrowserWorkerError("BROWSER", "userDataDir must not be empty");
    if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0)) {
      throw new ReieBrowserWorkerError("BROWSER", "timeoutMs must be positive");
    }
  }

  async start(): Promise<void> {
    if (this.context) return;
    try {
      this.context = await chromium.launchPersistentContext(this.options.userDataDir, {
        headless: this.options.headless ?? true,
      });
      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(this.options.timeoutMs ?? 15_000);
    } catch (error) {
      throw new ReieBrowserWorkerError("BROWSER", error instanceof Error ? error.message : String(error));
    }
  }

  async navigate(uri: string): Promise<void> {
    const url = this.validateUri(uri);
    await this.ensureStarted();
    try {
      await this.page!.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: this.options.timeoutMs ?? 15_000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/timeout/i.test(message)) throw new ReieBrowserWorkerError("TIMEOUT", message);
      throw new ReieBrowserWorkerError("BROWSER", message);
    }
  }

  async captureCurrentPage(uri = this.page?.url() ?? ""): Promise<ReieBrowserSourceCapture> {
    await this.ensureStarted();
    const url = this.validateUri(uri);
    try {
      const title = await this.page!.title();
      const content = await this.page!.locator("body").innerText();
      const publisher = await this.page!.locator('meta[property="og:site_name"]').getAttribute("content").catch(() => null);
      return {
        uri: url.toString(),
        title,
        ...(publisher?.trim() ? { publisher: publisher.trim() } : {}),
        observedAt: new Date().toISOString(),
        content,
        mediaType: "text/plain",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/timeout/i.test(message)) throw new ReieBrowserWorkerError("TIMEOUT", message);
      throw new ReieBrowserWorkerError("BROWSER", message);
    }
  }

  async screenshot(path: string): Promise<void> {
    if (!path.trim()) throw new ReieBrowserWorkerError("BROWSER", "screenshot path must not be empty");
    await this.ensureStarted();
    try {
      await this.page!.screenshot({ path, fullPage: true });
    } catch (error) {
      throw new ReieBrowserWorkerError("BROWSER", error instanceof Error ? error.message : String(error));
    }
  }

  async close(): Promise<void> {
    if (!this.context) return;
    await this.context.close();
    this.context = undefined;
    this.page = undefined;
  }

  private validateUri(uri: string): URL {
    let url: URL;
    try { url = new URL(uri); } catch { throw new ReieBrowserWorkerError("INVALID_URL", "Invalid URL"); }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new ReieBrowserWorkerError("INVALID_URL", "Only HTTP(S) URLs are allowed");
    }
    const allowed = this.options.allowedHosts ?? [];
    if (allowed.length && !allowed.includes(url.hostname)) {
      throw new ReieBrowserWorkerError("HOST_NOT_ALLOWED", "Host is not allowed: " + url.hostname);
    }
    return url;
  }

  private async ensureStarted(): Promise<void> {
    if (!this.context || !this.page) await this.start();
  }
}
