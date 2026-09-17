declare module "node:crypto" {
  export function randomUUID(): string;
  export function createHash(algorithm: string): {
    update(data: string | Uint8Array): { digest(encoding: "hex"): string };
  };
  export function sign(algorithm: string | null, data: string | Uint8Array, key: string): Uint8Array & { toString(encoding: "base64url"): string };
  export function verify(algorithm: string | null, data: string | Uint8Array, key: string, signature: Uint8Array): boolean;
  export function generateKeyPairSync(type: "ed25519"): {
    privateKey: { export(options: { type: "pkcs8"; format: "pem" }): { toString(): string } };
    publicKey: { export(options: { type: "spki"; format: "pem" }): { toString(): string } };
  };
}

declare module "node:test" {
  type TestFn = (name: string, fn: () => void | Promise<void>) => void;
  const test: TestFn;
  export default test;
}

declare module "node:assert/strict" {
  export function equal(actual: unknown, expected: unknown, message?: string): void;
  export function deepEqual(actual: unknown, expected: unknown, message?: string): void;
  export function notEqual(actual: unknown, expected: unknown, message?: string): void;
  export function notDeepEqual(actual: unknown, expected: unknown, message?: string): void;
  export function ok(value: unknown, message?: string): asserts value;
  export function throws(fn: () => unknown, error?: unknown): void;
  export function doesNotThrow(fn: () => unknown, message?: string): void;
}

declare module "node:fs" {
  export function appendFileSync(path: string | number, data: string | Uint8Array, encoding?: string): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function readFileSync(path: string): Uint8Array;
  export function renameSync(oldPath: string, newPath: string): void;
  export function writeFileSync(path: string | number, data: string | Uint8Array, encoding?: string): void;
  export function openSync(path: string, flags: string): number;
  export function fsyncSync(fd: number): void;
  export function closeSync(fd: number): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare const Buffer: { from(data: string, encoding: "base64url"): Uint8Array };
