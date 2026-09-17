import test from "node:test";
import assert from "node:assert/strict";
import {
  SifAdoptionError,
  SifAdoptionGateway,
  createDefaultSifAdoptionGateway,
  defaultSifAdoptionLimits,
  makeSifIntegrationEnvelope,
  type StandardSifHandlers,
} from "../src/adoption.js";
import type { SifProductRequest, SifProductResponse } from "../../../packages/sif-core/src/index.js";

const NOW = "2026-09-18T00:00:00.000Z";

function handlers(): StandardSifHandlers {
  return {
    "policy.check": ({ request }) => ({ accepted: true, payload: request.payload }),
    "knowledge.query": ({ request }) => ({ knowledge: request.payload }),
    "evaluation.run": ({ request }) => ({ evaluation: request.payload }),
    "systemic.query": ({ request }) => ({ systemic: request.payload }),
    "continuity.read": ({ request }) => ({ continuity: request.payload }),
    "federation.inspect": ({ request }) => ({ federation: request.payload }),
  };
}

function request(overrides: Partial<SifProductRequest> = {}): SifProductRequest {
  return {
    requestId: "integration-1",
    productId: "LARA_OS_REIE",
    adapterVersion: "1.0.0",
    operation: "policy.check",
    requestedCapabilities: ["sif.policy.check"],
    authorityScopes: ["product:lara:read"],
    evidenceIds: ["e-1"],
    payload: { b: 2, a: 1 },
    createdAt: NOW,
    ...overrides,
  };
}

function envelope(
  overrides: Partial<Parameters<typeof makeSifIntegrationEnvelope>[0]> = {},
) {
  return makeSifIntegrationEnvelope(
    request(overrides),
    "lara-os-reie",
    "corr-1",
    NOW,
  );
}

test("ADOPT-001 registers all three sovereign products", () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  assert.deepEqual(
    gateway.descriptors().map((x) => x.productId),
    ["LARA_OS_REIE", "QADRIX", "SOVEREIGN_LIBRARY"],
  );
});

test("ADOPT-002 executes a Lara request through the Core product adapter", async () => {
  const result = await createDefaultSifAdoptionGateway(handlers()).execute(envelope());
  assert.equal(result.response.status, "PASS");
  assert.equal(result.response.productId, "LARA_OS_REIE");
  assert.equal(result.replayVerified, true);
  assert.equal(result.evidence.sequence, 1);
});

test("ADOPT-003 creates an append-only evidence record for execution", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  const result = await gateway.execute(envelope());
  assert.equal(result.evidence.requestDigest, result.response.requestDigest);
  assert.equal(result.evidence.responseDigest, result.response.responseDigest);
  assert.equal(gateway.evidenceLedger.list().length, 1);
  gateway.evidenceLedger.verify();
});

test("ADOPT-004 is idempotent for the same requestId and envelope", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  const first = await gateway.execute(envelope());
  const second = await gateway.execute(envelope());
  assert.deepEqual(second, first);
  assert.equal(gateway.evidenceLedger.list().length, 1);
});

test("ADOPT-005 rejects a reused requestId with changed input", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  await gateway.execute(envelope());
  await assert.rejects(
    () =>
      gateway.execute(
        envelope({ payload: { changed: true } }),
      ),
    (error: unknown) =>
      error instanceof SifAdoptionError && error.code === "IDEMPOTENCY_CONFLICT",
  );
});

test("ADOPT-006 normalizes source and correlation identifiers", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  const result = await gateway.execute(
    makeSifIntegrationEnvelope(request(), "  Lara OS  ", "  c-2  ", NOW),
  );
  assert.equal(result.response.status, "PASS");
  const [record] = gateway.evidenceLedger.list();
  assert.equal(record?.sequence, 1);
});

test("ADOPT-007 rejects an unsupported envelope version before Core dispatch", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  await assert.rejects(
    () =>
      gateway.execute({
        ...envelope(),
        envelopeVersion: "9.0" as "1.0",
      }),
    (error: unknown) =>
      error instanceof SifAdoptionError && error.code === "INVALID_ENVELOPE",
  );
  assert.equal(gateway.evidenceLedger.list().length, 0);
});

test("ADOPT-008 rejects an empty source system", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  await assert.rejects(
    () => gateway.execute(makeSifIntegrationEnvelope(request(), " ", "c", NOW)),
    (error: unknown) =>
      error instanceof SifAdoptionError && error.code === "INVALID_ENVELOPE",
  );
});

test("ADOPT-009 rejects an empty correlation id", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  await assert.rejects(
    () => gateway.execute(makeSifIntegrationEnvelope(request(), "lara", " ", NOW)),
    (error: unknown) =>
      error instanceof SifAdoptionError && error.code === "INVALID_ENVELOPE",
  );
});

test("ADOPT-010 rejects an invalid requestedAt timestamp", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  await assert.rejects(
    () => gateway.execute(makeSifIntegrationEnvelope(request(), "lara", "c", "bad")),
    (error: unknown) =>
      error instanceof SifAdoptionError && error.code === "INVALID_ENVELOPE",
  );
});

test("ADOPT-011 enforces the integration envelope byte limit", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers(), {
    ...defaultSifAdoptionLimits(),
    maxEnvelopeBytes: 64,
  });
  await assert.rejects(
    () => gateway.execute(envelope()),
    (error: unknown) =>
      error instanceof SifAdoptionError && error.code === "RESOURCE_EXHAUSTED",
  );
});

test("ADOPT-012 keeps the Core request and response boundaries intact", async () => {
  const payload = { nested: { value: 1 } };
  const gateway = createDefaultSifAdoptionGateway({
    ...handlers(),
    "policy.check": ({ request }) => {
      (request.payload as { nested: { value: number } }).nested.value = 9;
      return request.payload;
    },
  });
  await gateway.execute(makeSifIntegrationEnvelope(request({ payload }), "lara", "c", NOW));
  assert.equal(payload.nested.value, 1);
});

test("ADOPT-013 can dispatch QADRIX through the same gateway", async () => {
  const result = await createDefaultSifAdoptionGateway(handlers()).execute(
    makeSifIntegrationEnvelope(
      request({
        requestId: "q-1",
        productId: "QADRIX",
        authorityScopes: ["product:qadrix:read"],
      }),
      "qadrix",
      "q-corr",
      NOW,
    ),
  );
  assert.equal(result.response.status, "PASS");
  assert.equal(result.response.productId, "QADRIX");
});

test("ADOPT-014 can dispatch Sovereign Library through the same gateway", async () => {
  const result = await createDefaultSifAdoptionGateway(handlers()).execute(
    makeSifIntegrationEnvelope(
      request({
        requestId: "lib-1",
        productId: "SOVEREIGN_LIBRARY",
        operation: "knowledge.query",
        requestedCapabilities: ["sif.knowledge.query"],
        authorityScopes: ["product:library:read"],
      }),
      "sovereign-library",
      "lib-corr",
      NOW,
    ),
  );
  assert.equal(result.response.status, "PASS");
  assert.equal(result.response.productId, "SOVEREIGN_LIBRARY");
});

test("ADOPT-015 fails closed for an unregistered product", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  const result = await gateway.execute(
    makeSifIntegrationEnvelope(
      request({ requestId: "unknown-1", productId: "UNKNOWN" }),
      "unknown",
      "unknown-corr",
      NOW,
    ),
  );
  assert.equal(result.response.status, "UNAVAILABLE");
  assert.equal(result.replayVerified, false);
  assert.equal(gateway.evidenceLedger.list().length, 1);
});

test("ADOPT-016 preserves deterministic envelope digests", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  const a = await gateway.execute(envelope());
  const b = await gateway.execute(
    makeSifIntegrationEnvelope(
      request({ requestId: "integration-2" }),
      "lara-os-reie",
      "corr-1",
      NOW,
    ),
  );
  assert.equal(a.envelopeDigest, b.envelopeDigest);
});

test("ADOPT-017 bounds the processed-request cache", async () => {
  const limits = { ...defaultSifAdoptionLimits(), maxProcessedRequests: 2 };
  const gateway = createDefaultSifAdoptionGateway(handlers(), limits);
  await gateway.execute(envelope({ requestId: "a" }));
  await gateway.execute(envelope({ requestId: "b" }));
  await gateway.execute(envelope({ requestId: "c" }));
  assert.equal(gateway.processedRequestCount(), 2);
});

test("ADOPT-018 preserves replay verification for valid Core responses", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  const result = await gateway.execute(envelope());
  assert.equal(result.replayVerified, true);
  gateway.evidenceLedger.verify();
});

test("ADOPT-019 descriptor inventory is defensive", () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  const descriptors = gateway.descriptors();
  descriptors[0]!.allowedOperations.length = 0;
  assert.ok(gateway.descriptors()[0]!.allowedOperations.length > 0);
});

test("ADOPT-020 gateway accepts an explicit registry and evidence ledger", async () => {
  const gateway = new SifAdoptionGateway();
  for (const adapter of gateway.descriptors()) {
    assert.equal(typeof adapter.productId, "string");
  }
  const limits = defaultSifAdoptionLimits();
  assert.equal(limits.maxEnvelopeBytes, 192 * 1024);
});

test("ADOPT-021 Core response tampering remains detectable", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  const result = await gateway.execute(envelope());
  const tampered: SifProductResponse = { ...result.response, output: { tampered: true } };
  assert.notEqual(tampered.responseDigest, result.response.responseDigest);
});
