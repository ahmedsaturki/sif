import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultSifAdoptionGateway,
  type StandardSifHandlers,
} from "../dist/adoption.js";
import {
  createReieSifBridge,
  makeReieSifEnvelope,
  reieKnowledgeQuery,
  reiePolicyCheck,
} from "../dist/reie.js";

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

function input() {
  return {
    requestId: "reie-1",
    operation: "policy.check" as const,
    requestedCapabilities: ["sif.policy.check"],
    authorityScopes: ["product:lara:read"],
    evidenceIds: ["reie-source-1"],
    payload: { propertyId: "P-1", action: "inspect" },
    correlationId: "reie-corr-1",
    requestedAt: NOW,
  };
}

test("REIE-001 maps an invocation to the fixed Lara product contract", () => {
  const envelope = makeReieSifEnvelope(input());
  assert.equal(envelope.envelopeVersion, "1.0");
  assert.equal(envelope.sourceSystem, "lara-os-reie");
  assert.equal(envelope.correlationId, "reie-corr-1");
  assert.equal(envelope.request.productId, "LARA_OS_REIE");
  assert.equal(envelope.request.adapterVersion, "1.0.0");
});

test("REIE-002 executes a policy check through the SIF gateway", async () => {
  const bridge = createReieSifBridge(createDefaultSifAdoptionGateway(handlers()));
  const result = await reiePolicyCheck(bridge, {
    ...input(),
    requestId: "reie-policy-1",
  });
  assert.equal(result.response.productId, "LARA_OS_REIE");
  assert.equal(result.response.operation, "policy.check");
  assert.equal(result.response.status, "PASS");
  assert.equal(result.replayVerified, true);
});

test("REIE-003 executes a knowledge query without exposing gateway internals", async () => {
  const bridge = createReieSifBridge(createDefaultSifAdoptionGateway(handlers()));
  const result = await reieKnowledgeQuery(bridge, {
    ...input(),
    requestId: "reie-knowledge-1",
    payload: { entityId: "E-1", question: "match" },
  });
  assert.equal(result.response.operation, "knowledge.query");
  assert.deepEqual(result.response.output, {
    knowledge: { entityId: "E-1", question: "match" },
  });
});

test("REIE-004 retains request idempotency at the SIF boundary", async () => {
  const gateway = createDefaultSifAdoptionGateway(handlers());
  const bridge = createReieSifBridge(gateway);
  const first = await reiePolicyCheck(bridge, {
    ...input(),
    requestId: "reie-idempotent-1",
  });
  const second = await reiePolicyCheck(bridge, {
    ...input(),
    requestId: "reie-idempotent-1",
  });
  assert.deepEqual(second, first);
  assert.equal(gateway.evidenceLedger.list().length, 1);
});

test("REIE-005 preserves fail-closed authority enforcement", async () => {
  const bridge = createReieSifBridge(createDefaultSifAdoptionGateway(handlers()));
  const result = await reiePolicyCheck(bridge, {
    ...input(),
    requestId: "reie-authority-1",
    authorityScopes: ["product:lara:execute"],
  });
  assert.equal(result.response.status, "FAIL");
});

test("REIE-006 keeps payload ownership isolated from handlers", async () => {
  const payload = { nested: { value: 1 } };
  const gateway = createDefaultSifAdoptionGateway({
    ...handlers(),
    "policy.check": ({ request }) => {
      (request.payload as { nested: { value: number } }).nested.value = 9;
      return request.payload;
    },
  });
  const bridge = createReieSifBridge(gateway);
  await reiePolicyCheck(bridge, {
    ...input(),
    requestId: "reie-clone-1",
    payload,
  });
  assert.equal(payload.nested.value, 1);
});
