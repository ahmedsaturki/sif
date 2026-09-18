declare module "node:crypto" {
  export function createHash(algorithm: string): {
    update(data: string, inputEncoding?: string): {
      digest(encoding: "hex"): string;
    };
  };
}

declare module "node:fs/promises" {
  export function appendFile(path: string, data: string, encoding?: string): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function writeFile(path: string, data: string, encoding?: string): Promise<void>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function mkdtemp(prefix: string): Promise<string>;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare const process: {
  argv: string[];
  exitCode: number;
  exit(code?: number): never;
};

declare module "node:http" {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    on(event: "data", listener: (chunk: unknown) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "error", listener: (error: unknown) => void): this;
    setEncoding(encoding: string): this;
    destroy(): void;
  }
  export interface ServerResponse {
    writeHead(status: number, headers?: Record<string, string>): this;
    end(data?: string): void;
  }
  export interface Server {
    once(event: "error", listener: (error: unknown) => void): this;
    listen(port: number, host: string, listener: () => void): this;
    address(): { port: number } | string | null;
    close(callback: (error?: unknown) => void): void;
  }
  export function createServer(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Server;
}
