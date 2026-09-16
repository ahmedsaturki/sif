import test from "node:test";
import assert from "node:assert/strict";
import {
  FederationProtocolError,
  assertFederationMessageWithinNegotiatedLimits,
  assertFederationNegotiationScope,
  negotiateFederationCapabilities,
  type FederationNegotiationProfile,
} from "../src/index.js";

function profile(overrides: Partial<FederationNegotiationProfile> = {}): FederationNegotiationProfile {
  return {
    protocolVersions: ["0.1"],
    envelopeVersions: ["1"],
    authenticationModes: ["mtls"],
    signatureAlgorithms: ["Ed25519"],
    replayModes: ["durable-nonce-v1"],
    reconciliationModes: ["evidence-cursor-v1"],
    orderingGuarantees: ["per-stream"],
    maxMessageSize: 1_000_000,
    maxAttachmentSize: 5_000_000,
    capabilities: [
      { id: "evidence.read", version: "1", semantics: "read-only-evidence-v1", mandatory: true },
      { id: "event.observe", version: "1", semantics: "observation-reference-v1" },
    ],
    ...overrides,
  };
}

const scope = { peerId: "remote-a/workload-a", sessionId: "session-001", protocolVersion: "0.1" };

test("compatible profiles produce an explicit session-scoped negotiated result", () => {
  const negotiated = negotiateFederationCapabilities(profile(), profile(), scope);
  assert.deepEqual(negotiated.scope, scope);
  assert.equal(negotiated.protocolVersion, "0.1");
  assert.equal(negotiated.envelopeVersion, "1");
  assert.equal(negotiated.signatureAlgorithm, "Ed25519");
  assert.equal(negotiated.maxMessageSize, 1_000_000);
  assert.deepEqual(negotiated.capabilities, [
    { id: "event.observe", version: "1", semantics: "observation-reference-v1" },
    { id: "evidence.read", version: "1", semantics: "read-only-evidence-v1" },
  ]);
});

test("unsupported mandatory capability fails closed", () => {
  assert.throws(
    () => negotiateFederationCapabilities(profile(), profile({ capabilities: [{ id: "event.observe", version: "1", semantics: "observation-reference-v1" }] }), scope),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "CAPABILITY_INCOMPATIBLE",
  );
});

test("syntactically matching capability with different semantics fails closed", () => {
  assert.throws(
    () => negotiateFederationCapabilities(profile(), profile({ capabilities: [
      { id: "evidence.read", version: "1", semantics: "different-meaning", mandatory: true },
      { id: "event.observe", version: "1", semantics: "observation-reference-v1" },
    ] }), scope),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "CAPABILITY_INCOMPATIBLE",
  );
});

test("missing protocol intersection fails closed rather than silently downgrading", () => {
  assert.throws(
    () => negotiateFederationCapabilities(profile({ protocolVersions: ["0.1"] }), profile({ protocolVersions: ["0.2"] }), { ...scope, protocolVersion: "0.1" }),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "CAPABILITY_INCOMPATIBLE",
  );
});

test("negotiated capability cannot be reused outside its peer/session scope", () => {
  const negotiated = negotiateFederationCapabilities(profile(), profile(), scope);
  assert.doesNotThrow(() => assertFederationNegotiationScope(negotiated, scope));
  assert.throws(
    () => assertFederationNegotiationScope(negotiated, { ...scope, sessionId: "session-002" }),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "CAPABILITY_INCOMPATIBLE",
  );
});

test("effective resource limits are bounded by the stricter peer", () => {
  const negotiated = negotiateFederationCapabilities(
    profile({ maxMessageSize: 100_000, maxAttachmentSize: 900_000 }),
    profile({ maxMessageSize: 80_000, maxAttachmentSize: 1_000_000 }),
    scope,
  );
  assert.equal(negotiated.maxMessageSize, 80_000);
  assert.equal(negotiated.maxAttachmentSize, 900_000);
  assert.doesNotThrow(() => assertFederationMessageWithinNegotiatedLimits(negotiated, 80_000, 900_000));
  assert.throws(
    () => assertFederationMessageWithinNegotiatedLimits(negotiated, 80_001, 100),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED",
  );
  assert.throws(
    () => assertFederationMessageWithinNegotiatedLimits(negotiated, 100, 900_001),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED",
  );
});
