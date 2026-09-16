import test from "node:test";
import assert from "node:assert/strict";
import {
  FederationLocalAdmission,
  FederationProtocolError,
  PolicyEngine,
  negotiateFederationCapabilities,
  type FederationEnvelope,
  type FederationTrustDecision,
  type FederationNegotiationProfile,
} from "../src/index.js";

const envelope: FederationEnvelope = {
  protocol: "sif-federation",
  protocolVersion: "0.1",
  schema: "sif.federation.envelope",
  schemaVersion: "1",
  sender: { domain: "remote-a", subject: "workload-a", transportBinding: "spiffe://remote-a/workload-a" },
  targetDomain: "local-a",
  messageId: "msg-admission-001",
  eventId: "evt-admission-001",
  provenanceId: "prov-admission-001",
  time: {
    occurredAt: "2026-09-16T06:00:00.000Z",
    observedAt: "2026-09-16T06:00:01.000Z",
    expiresAt: "2026-09-16T07:00:00.000Z",
    semantics: "event-and-observation",
  },
  capabilities: [{ id: "evidence.read", version: "1" }],
  payload: { type: "evidence", data: { value: 1 } },
  replayNonce: "nonce-admission-001",
  payloadDigest: "verified-outside-admission-test",
  signatureAlgorithm: "Ed25519",
  signature: "verified-outside-admission-test",
};

const trust: FederationTrustDecision = {
  identity: envelope.sender,
  trustAnchorId: "anchor-a",
  authenticated: true,
  authorizedForLocalDomain: true,
};

function profile(): FederationNegotiationProfile {
  return {
    protocolVersions: ["0.1"],
    envelopeVersions: ["1"],
    authenticationModes: ["mtls"],
    signatureAlgorithms: ["Ed25519"],
    replayModes: ["durable-nonce-v1"],
    reconciliationModes: ["evidence-cursor-v1"],
    orderingGuarantees: ["per-stream"],
    maxMessageSize: 100_000,
    maxAttachmentSize: 500_000,
    capabilities: [{ id: "evidence.read", version: "1", semantics: "read-only-evidence-v1", mandatory: true }],
  };
}

function negotiation() {
  return negotiateFederationCapabilities(profile(), profile(), {
    peerId: "remote-a/workload-a",
    sessionId: "session-admission-001",
    protocolVersion: "0.1",
  });
}

function admissionEngine() {
  const policy = new PolicyEngine();
  policy.addRule({
    id: "allow-evidence-read",
    effect: "allow",
    subject: "remote-a/workload-a",
    capability: "evidence.read",
    scopePrefix: "evidence",
    reason: "locally admitted evidence-read operation",
  });
  return new FederationLocalAdmission("local-a", policy);
}

test("trusted remote identity still requires explicit local policy admission", () => {
  const decision = admissionEngine().admit({
    envelope,
    trust,
    negotiation: negotiation(),
    capabilityId: "evidence.read",
    effectClass: "read-evidence",
    policyVersion: "policy-v1",
    assertedScope: "evidence/project-a",
  });
  assert.equal(decision.admitted, true);
  assert.equal(decision.ruleId, "allow-evidence-read");
  assert.equal(decision.peerDomain, "remote-a");
});

test("remote authority assertion cannot bypass the local default deny", () => {
  const engine = new FederationLocalAdmission("local-a", new PolicyEngine());
  assert.throws(
    () => engine.admit({
      envelope,
      trust,
      negotiation: negotiation(),
      capabilityId: "evidence.read",
      effectClass: "write-local-state",
      policyVersion: "policy-v1",
      assertedScope: "local-state",
    }),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "AUTHORIZATION_DENIED",
  );
});

test("envelope sender and authenticated peer identity must match", () => {
  assert.throws(
    () => admissionEngine().admit({
      envelope,
      trust: { ...trust, identity: { ...trust.identity, subject: "different-workload" } },
      negotiation: negotiation(),
      capabilityId: "evidence.read",
      effectClass: "read-evidence",
      policyVersion: "policy-v1",
      assertedScope: "evidence/project-a",
    }),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "AUTHENTICATION_FAILURE",
  );
});

test("capability outside the negotiated session is rejected", () => {
  assert.throws(
    () => admissionEngine().admit({
      envelope: { ...envelope, capabilities: [{ id: "event.write", version: "1" }] },
      trust,
      negotiation: negotiation(),
      capabilityId: "event.write",
      effectClass: "write-event",
      policyVersion: "policy-v1",
      assertedScope: "events/project-a",
    }),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "CAPABILITY_INCOMPATIBLE",
  );
});

test("message targeting another domain is rejected even with authenticated trust", () => {
  assert.throws(
    () => admissionEngine().admit({
      envelope: { ...envelope, targetDomain: "other-local" },
      trust,
      negotiation: negotiation(),
      capabilityId: "evidence.read",
      effectClass: "read-evidence",
      policyVersion: "policy-v1",
      assertedScope: "evidence/project-a",
    }),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "AUTHORIZATION_DENIED",
  );
});
