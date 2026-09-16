import test from "node:test";
import assert from "node:assert/strict";
import {
  FEDERATION_PROTOCOL,
  FederationProtocolError,
  FederationTransportBoundary,
  InMemoryFederationTransportAdapter,
  createUnsignedFederationEnvelope,
  negotiateFederationCapabilities,
  type FederationNegotiationProfile,
} from "../src/index.js";

const profile: FederationNegotiationProfile = {
  protocolVersions: ["0.1"],
  envelopeVersions: ["1"],
  authenticationModes: ["test-auth"],
  signatureAlgorithms: ["Ed25519"],
  replayModes: ["nonce-v1"],
  reconciliationModes: ["cursor-v1"],
  orderingGuarantees: ["best-effort"],
  maxMessageSize: 1024,
  maxAttachmentSize: 512,
  capabilities: [],
};

const peer = { domain: "domain-a", subject: "workload-a", transportBinding: "spiffe://domain-a/workload-a" };

function envelope() {
  return {
    ...createUnsignedFederationEnvelope({
      protocol: FEDERATION_PROTOCOL,
      protocolVersion: "0.1",
      schema: "sif.federation.envelope",
      schemaVersion: "1",
      sender: peer,
      targetDomain: "domain-b",
      messageId: "msg-001",
      eventId: "evt-001",
      provenanceId: "prov-001",
      time: { occurredAt: "2026-09-16T06:00:00.000Z", observedAt: "2026-09-16T06:00:01.000Z", semantics: "event-and-observation" },
      capabilities: [],
      payload: { type: "evidence", data: { value: 1 } },
      replayNonce: "nonce-001",
    }),
    signature: "test-signature",
  };
}

test("transport boundary binds session identity and local domain", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, { peerId: peer.domain, sessionId: "session-001", protocolVersion: "0.1" });
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  const session = await boundary.open("domain-b", peer, negotiated.scope, negotiated);
  assert.equal(session.localDomain, "domain-b");
  assert.equal(session.peerIdentity.domain, "domain-a");
  assert.equal(session.authenticated, true);
});

test("matching envelope is delivered and preserved", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, { peerId: peer.domain, sessionId: "session-002", protocolVersion: "0.1" });
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  const session = await boundary.open("domain-b", peer, negotiated.scope, negotiated);
  const result = await boundary.send(session, envelope(), 100, 0);
  assert.equal(result.outcome, "DELIVERED");
  assert.equal(adapter.listReceived().length, 1);
  assert.equal(adapter.listReceived()[0]?.messageId, "msg-001");
});

test("sender/session mismatch fails before provider send", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, { peerId: peer.domain, sessionId: "session-003", protocolVersion: "0.1" });
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  const session = await boundary.open("domain-b", peer, negotiated.scope, negotiated);
  const bad = { ...envelope(), sender: { ...peer, subject: "other" } };
  await assert.rejects(() => boundary.send(session, bad, 100, 0), (error: unknown) => error instanceof FederationProtocolError && error.code === "AUTHENTICATION_FAILURE");
  assert.equal(adapter.listReceived().length, 0);
});

test("oversized message is rejected before provider send", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, { peerId: peer.domain, sessionId: "session-004", protocolVersion: "0.1" });
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  const session = await boundary.open("domain-b", peer, negotiated.scope, negotiated);
  await assert.rejects(() => boundary.send(session, envelope(), 1025, 0), (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED");
});

test("closed provider session reports peer unavailable", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, { peerId: peer.domain, sessionId: "session-005", protocolVersion: "0.1" });
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  const session = await boundary.open("domain-b", peer, negotiated.scope, negotiated);
  await boundary.close(session);
  const result = await adapter.send({ session, envelope: envelope(), messageSize: 100, attachmentSize: 0 });
  assert.equal(result.outcome, "PEER_UNAVAILABLE");
});
