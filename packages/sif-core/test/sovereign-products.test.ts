import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryProductEvidenceLedger,
  SovereignProductError,
  SifProductAdapterRegistry,
  computeProductRequestDigest,
  createLaraOsReieAdapter,
  createQadrixAdapter,
  createSovereignLibraryAdapter,
  defaultSifProductAdapterLimits,
  verifySifProductReplay,
  type ProductOperationHandler,
  type SifProductAdapter,
  type SifProductDescriptor,
  type SifProductRequest,
} from "../src/index.js";

const LIMITS = defaultSifProductAdapterLimits();
const NOW = "2026-09-17T17:30:00.000Z";

function handlers(): Record<string, ProductOperationHandler> {
  return {
    "policy.check": ({ request }) => ({ accepted: true, payload: request.payload }),
    "knowledge.query": ({ request }) => ({ knowledge: request.payload }),
    "evaluation.run": ({ request }) => ({ evaluation: request.payload }),
    "systemic.query": ({ request }) => ({ systemic: request.payload }),
    "continuity.read": ({ request }) => ({ continuity: request.payload }),
    "federation.inspect": ({ request }) => ({ federation: request.payload }),
  };
}
function lara(): SifProductAdapter { return createLaraOsReieAdapter(handlers()); }
function qadrix(): SifProductAdapter { return createQadrixAdapter(handlers()); }
function library(): SifProductAdapter { return createSovereignLibraryAdapter(handlers()); }
function request(overrides: Partial<SifProductRequest> = {}): SifProductRequest {
  return { requestId: "req-1", productId: "LARA_OS_REIE", adapterVersion: "1.0.0", operation: "policy.check", requestedCapabilities: ["sif.policy.check"], authorityScopes: ["product:lara:read"], evidenceIds: ["e-1", "e-2"], payload: { b: 2, a: 1 }, createdAt: NOW, ...overrides };
}
function throwsCode(fn: () => unknown, code: SovereignProductError["code"]): void { assert.throws(fn, (error: unknown) => error instanceof SovereignProductError && error.code === code); }
function fakeAdapter(productId: string): SifProductAdapter {
  const descriptor: SifProductDescriptor = { productId, adapterVersion: "1.0.0", protocolVersion: "1.0", capabilities: [], allowedAuthorityScopes: [], allowedOperations: [] };
  return { descriptor, execute: async (input) => ({ requestId: input.requestId, productId, adapterVersion: "1.0.0", operation: input.operation, status: "PASS", requestDigest: "r", capabilityIds: [], authorityScopes: [], evidenceIds: [], output: null, responseDigest: "d" }) };
}

test("F9-001 request digest is deterministic", () => { assert.equal(computeProductRequestDigest(request(), LIMITS), computeProductRequestDigest(structuredClone(request()), LIMITS)); });
test("F9-002 request digest ignores array ordering after normalization", () => { assert.equal(computeProductRequestDigest(request(), LIMITS), computeProductRequestDigest(request({ evidenceIds: ["e-2", "e-1"] }), LIMITS)); });
test("F9-003 request timestamp is normalized", async () => { const seen: string[] = []; const adapter = createLaraOsReieAdapter({ "policy.check": ({ request }) => { seen.push(request.createdAt); return true; } }); await adapter.execute(request({ createdAt: "2026-09-17T19:30:00+02:00" })); assert.deepEqual(seen, [NOW]); });
test("F9-004 request payload is cloned before handler", async () => { const input = { nested: { value: 1 } }; const adapter = createLaraOsReieAdapter({ "policy.check": ({ request }) => { (request.payload as { nested: { value: number } }).nested.value = 9; return request.payload; } }); await adapter.execute(request({ payload: input })); assert.equal(input.nested.value, 1); });
test("F9-005 request rejects empty request id", async () => { assert.equal((await lara().execute(request({ requestId: "" }))).status, "FAIL"); });
test("F9-006 request rejects empty operation", async () => { assert.equal((await lara().execute(request({ operation: "" }))).status, "FAIL"); });
test("F9-007 request rejects invalid timestamp", async () => { assert.equal((await lara().execute(request({ createdAt: "bad" }))).status, "FAIL"); });
test("F9-008 request rejects duplicate capabilities", async () => { assert.equal((await lara().execute(request({ requestedCapabilities: ["sif.policy.check", "sif.policy.check"] }))).status, "FAIL"); });
test("F9-009 request rejects duplicate evidence", async () => { assert.equal((await lara().execute(request({ evidenceIds: ["e-1", "e-1"] }))).status, "FAIL"); });
test("F9-010 request enforces payload byte bound", async () => { const limits = { ...LIMITS, maxRequestBytes: 10 }; assert.equal((await createLaraOsReieAdapter(handlers(), limits).execute(request())).status, "UNAVAILABLE"); });

test("F9-011 product identity mismatch fails closed", async () => { assert.equal((await lara().execute(request({ productId: "QADRIX", authorityScopes: ["product:lara:read"] }))).status, "UNAVAILABLE"); });
test("F9-012 adapter version mismatch fails closed", async () => { assert.equal((await lara().execute(request({ adapterVersion: "9.0.0" }))).status, "UNAVAILABLE"); });
test("F9-013 unsupported capability fails closed", async () => { assert.equal((await lara().execute(request({ requestedCapabilities: ["sif.unknown"] }))).status, "FAIL"); });
test("F9-014 capability required authority must be present", async () => { assert.equal((await lara().execute(request({ authorityScopes: [] }))).status, "FAIL"); });
test("F9-015 authority widening fails closed", async () => { assert.equal((await lara().execute(request({ authorityScopes: ["product:lara:read", "admin"] }))).status, "FAIL"); });
test("F9-016 undeclared operation fails closed", async () => { assert.equal((await lara().execute(request({ operation: "delete_everything" }))).status, "FAIL"); });
test("F9-017 missing handler is unavailable", async () => { const adapter = createLaraOsReieAdapter({ "policy.check": handlers()["policy.check"]! }); assert.equal((await adapter.execute(request({ operation: "knowledge.query", requestedCapabilities: ["sif.knowledge.query"] }))).status, "UNAVAILABLE"); });
test("F9-018 handler failure is indeterminate", async () => { const adapter = createLaraOsReieAdapter({ "policy.check": () => { throw new Error("boom"); } }); assert.equal((await adapter.execute(request())).status, "INDETERMINATE"); });
test("F9-019 response output is bounded", async () => { const limits = { ...LIMITS, maxResponseBytes: 8 }; assert.equal((await createLaraOsReieAdapter({ "policy.check": () => "this is too large" }, limits).execute(request())).status, "FAIL"); });
test("F9-020 successful response binds request digest", async () => { const result = await lara().execute(request()); assert.equal(result.status, "PASS"); assert.equal(result.requestDigest, computeProductRequestDigest(request(), LIMITS)); });

test("F9-021 response normalizes capability order", async () => { const result = await lara().execute(request()); assert.deepEqual(result.capabilityIds, ["sif.policy.check"]); });
test("F9-022 response normalizes authority order", async () => { const result = await lara().execute(request()); assert.deepEqual(result.authorityScopes, ["product:lara:read"]); });
test("F9-023 response normalizes evidence order", async () => { const result = await lara().execute(request({ evidenceIds: ["e-2", "e-1"] })); assert.deepEqual(result.evidenceIds, ["e-1", "e-2"]); });
test("F9-024 caller payload survives handler mutation", async () => { const payload = { value: 1 }; const adapter = createLaraOsReieAdapter({ "policy.check": ({ request }) => { (request.payload as { value: number }).value = 2; return request.payload; } }); await adapter.execute(request({ payload })); assert.equal(payload.value, 1); });
test("F9-025 handler receives cloned descriptor", async () => { let observed = ""; const adapter = createLaraOsReieAdapter({ "policy.check": ({ descriptor }) => { descriptor.allowedOperations.length = 0; observed = descriptor.productId; return true; } }); await adapter.execute(request()); assert.equal(observed, "LARA_OS_REIE"); assert.equal(adapter.descriptor.allowedOperations.includes("policy.check"), true); });
test("F9-026 request digest changes with payload", () => { assert.notEqual(computeProductRequestDigest(request(), LIMITS), computeProductRequestDigest(request({ payload: { a: 99, b: 2 } }), LIMITS)); });
test("F9-027 response digest changes with output", async () => { const a = await createLaraOsReieAdapter({ "policy.check": () => ({ value: 1 }) }).execute(request()); const b = await createLaraOsReieAdapter({ "policy.check": () => ({ value: 2 }) }).execute(request()); assert.notEqual(a.responseDigest, b.responseDigest); });
test("F9-028 successful response is replay-verifiable", async () => { const result = await lara().execute(request()); verifySifProductReplay(request(), result, LIMITS); });
test("F9-029 tampered request is rejected by replay", async () => { const result = await lara().execute(request()); throwsCode(() => verifySifProductReplay(request({ payload: { changed: true } }), result, LIMITS), "REPLAY_MISMATCH"); });
test("F9-030 tampered response is rejected by replay", async () => { const result = await lara().execute(request()); throwsCode(() => verifySifProductReplay(request(), { ...result, output: { changed: true } }, LIMITS), "REPLAY_MISMATCH"); });

test("F9-031 Lara adapter declares Lara identity", () => { assert.equal(lara().descriptor.productId, "LARA_OS_REIE"); });
test("F9-032 Lara adapter exposes policy", () => { assert.equal(lara().descriptor.capabilities.some((x) => x.capabilityId === "sif.policy.check"), true); });
test("F9-033 QADRIX adapter declares QADRIX identity", () => { assert.equal(qadrix().descriptor.productId, "QADRIX"); });
test("F9-034 QADRIX adapter exposes knowledge", () => { assert.equal(qadrix().descriptor.capabilities.some((x) => x.capabilityId === "sif.knowledge.query"), true); });
test("F9-035 Sovereign Library adapter declares identity", () => { assert.equal(library().descriptor.productId, "SOVEREIGN_LIBRARY"); });
test("F9-036 Sovereign Library exposes federation inspection", () => { assert.equal(library().descriptor.capabilities.some((x) => x.capabilityId === "sif.federation.inspect"), true); });
test("F9-037 Lara evaluation requires execute authority", async () => { const result = await lara().execute(request({ operation: "evaluation.run", requestedCapabilities: ["sif.evaluation.run"], authorityScopes: ["product:lara:execute"] })); assert.equal(result.status, "PASS"); });
test("F9-038 QADRIX evaluation requires QADRIX execute authority", async () => { const result = await qadrix().execute(request({ productId: "QADRIX", operation: "evaluation.run", requestedCapabilities: ["sif.evaluation.run"], authorityScopes: ["product:qadrix:execute"] })); assert.equal(result.status, "PASS"); });
test("F9-039 Library federation inspection is read-only scoped", async () => { const result = await library().execute(request({ productId: "SOVEREIGN_LIBRARY", operation: "federation.inspect", requestedCapabilities: ["sif.federation.inspect"], authorityScopes: ["product:library:read"] })); assert.equal(result.status, "PASS"); });
test("F9-040 adapter versions and protocol are pinned", () => { for (const adapter of [lara(), qadrix(), library()]) { assert.equal(adapter.descriptor.adapterVersion, "1.0.0"); assert.equal(adapter.descriptor.protocolVersion, "1.0"); } });

test("F9-041 registry registers adapter", () => { const registry = new SifProductAdapterRegistry(); registry.register(lara()); assert.equal(registry.get("LARA_OS_REIE").descriptor.productId, "LARA_OS_REIE"); });
test("F9-042 registry rejects duplicate product adapter", () => { const registry = new SifProductAdapterRegistry(); registry.register(lara()); throwsCode(() => registry.register(lara()), "INVALID_DESCRIPTOR"); });
test("F9-043 registry bounds adapter count", () => { const registry = new SifProductAdapterRegistry({ ...LIMITS, maxAdapters: 2 }); registry.register(fakeAdapter("A")); registry.register(fakeAdapter("B")); throwsCode(() => registry.register(fakeAdapter("C")), "RESOURCE_EXHAUSTED"); });
test("F9-044 registry gets existing adapter", () => { const registry = new SifProductAdapterRegistry(); registry.register(qadrix()); assert.equal(registry.get("QADRIX").descriptor.productId, "QADRIX"); });
test("F9-045 registry rejects unknown get", () => { const registry = new SifProductAdapterRegistry(); throwsCode(() => registry.get("UNKNOWN"), "PRODUCT_NOT_FOUND"); });
test("F9-046 registry lists descriptors deterministically", () => { const registry = new SifProductAdapterRegistry(); registry.register(library()); registry.register(lara()); registry.register(qadrix()); assert.deepEqual(registry.listDescriptors().map((x) => x.productId), ["LARA_OS_REIE", "QADRIX", "SOVEREIGN_LIBRARY"]); });
test("F9-047 registry descriptor listing is cloned", () => { const registry = new SifProductAdapterRegistry(); registry.register(lara()); const descriptors = registry.listDescriptors(); descriptors[0]!.allowedOperations.length = 0; assert.equal(registry.listDescriptors()[0]!.allowedOperations.includes("policy.check"), true); });
test("F9-048 registry dispatches to matching adapter", async () => { const registry = new SifProductAdapterRegistry(); registry.register(qadrix()); const result = await registry.dispatch(request({ productId: "QADRIX", authorityScopes: ["product:qadrix:read"] })); assert.equal(result.productId, "QADRIX"); });
test("F9-049 registry returns unavailable for unknown product", async () => { assert.equal((await new SifProductAdapterRegistry().dispatch(request({ productId: "UNKNOWN" }))).status, "UNAVAILABLE"); });
test("F9-050 registry validates adapter capability limits", () => { const registry = new SifProductAdapterRegistry({ ...LIMITS, maxCapabilitiesPerAdapter: 1 }); const descriptor: SifProductDescriptor = { productId: "LIMITED", adapterVersion: "1.0.0", protocolVersion: "1.0", capabilities: [{ capabilityId: "a", plane: "POLICY", version: "1", mode: "READ", authorityScopes: [] }, { capabilityId: "b", plane: "POLICY", version: "1", mode: "READ", authorityScopes: [] }], allowedAuthorityScopes: [], allowedOperations: [] }; throwsCode(() => registry.register({ descriptor, execute: async (input) => ({ requestId: input.requestId, productId: "LIMITED", adapterVersion: "1.0.0", operation: input.operation, status: "PASS", requestDigest: "r", capabilityIds: [], authorityScopes: [], evidenceIds: [], responseDigest: "d" }) }), "RESOURCE_EXHAUSTED"); });

test("F9-051 evidence ledger starts sequence at one", async () => { const response = await lara().execute(request()); const ledger = new InMemoryProductEvidenceLedger(4); assert.equal(ledger.append(response, NOW).sequence, 1); });
test("F9-052 evidence ledger links previous digest", async () => { const response = await lara().execute(request()); const ledger = new InMemoryProductEvidenceLedger(4); const first = ledger.append(response, NOW); const second = ledger.append(response, "2026-09-17T17:31:00.000Z"); assert.equal(second.previousDigest, first.recordDigest); });
test("F9-053 evidence ledger list is cloned", async () => { const response = await lara().execute(request()); const ledger = new InMemoryProductEvidenceLedger(4); ledger.append(response, NOW); const records = ledger.list(); records[0]!.sequence = 99; assert.equal(ledger.list()[0]!.sequence, 1); });
test("F9-054 evidence ledger verifies intact chain", async () => { const response = await lara().execute(request()); const ledger = new InMemoryProductEvidenceLedger(4); ledger.append(response, NOW); ledger.append(response, "2026-09-17T17:31:00.000Z"); ledger.verify(); });
test("F9-055 evidence ledger detects record tampering", async () => { const response = await lara().execute(request()); const ledger = new InMemoryProductEvidenceLedger(4); ledger.append(response, NOW); const records = ledger.list(); records[0]!.responseDigest = "changed"; throwsCode(() => ledger.verify(records), "EVIDENCE_MISMATCH"); });
test("F9-056 evidence ledger detects chain linkage tampering", async () => { const response = await lara().execute(request()); const ledger = new InMemoryProductEvidenceLedger(4); ledger.append(response, NOW); ledger.append(response, "2026-09-17T17:31:00.000Z"); const records = ledger.list(); records[1]!.previousDigest = "changed"; throwsCode(() => ledger.verify(records), "EVIDENCE_MISMATCH"); });
test("F9-057 evidence ledger enforces record bound", async () => { const response = await lara().execute(request()); const ledger = new InMemoryProductEvidenceLedger(1); ledger.append(response, NOW); throwsCode(() => ledger.append(response, "2026-09-17T17:31:00.000Z"), "RESOURCE_EXHAUSTED"); });
test("F9-058 evidence record binds product and digests", async () => { const response = await lara().execute(request()); const record = new InMemoryProductEvidenceLedger(2).append(response, NOW); assert.equal(record.productId, response.productId); assert.equal(record.requestDigest, response.requestDigest); assert.equal(record.responseDigest, response.responseDigest); });
test("F9-059 evidence chain is deterministic for identical input", async () => { const response = await lara().execute(request()); const a = new InMemoryProductEvidenceLedger(2); const b = new InMemoryProductEvidenceLedger(2); a.append(response, NOW); b.append(response, NOW); assert.deepEqual(a.list(), b.list()); });
test("F9-060 all sovereign product adapters support explicit end-to-end replay", async () => { const paths: Array<[SifProductAdapter, SifProductRequest]> = [[lara(), request()], [qadrix(), request({ productId: "QADRIX", authorityScopes: ["product:qadrix:read"] })], [library(), request({ productId: "SOVEREIGN_LIBRARY", operation: "knowledge.query", requestedCapabilities: ["sif.knowledge.query"], authorityScopes: ["product:library:read"] })]]; for (const [adapter, input] of paths) { const response = await adapter.execute(input); assert.equal(response.status, "PASS"); verifySifProductReplay(input, response, LIMITS); } });
