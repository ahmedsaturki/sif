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
  type FederationTransportAdapter,
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

function scope(sessionId: string) {
  return { peerId: `${peer.domain}/${peer.subject}`, sessionId, protocolVersion: "0.1" };
}

async function expectFederationError(action: () => Promise<unknown> | unknown, code: FederationProtocolError["code"]): Promise<void> {
  let caught = false;
  try {
    await action();
  } catch (error) {
    caught = true;
    assert.equal(error instanceof FederationProtocolError, true);
    if (error instanceof FederationProtocolError) assert.equal(error.code, code);
  }
  assert.equal(caught, true);
}

test("transport boundary binds session identity and local domain", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, scope("session-001"));
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  const session = await boundary.open("domain-b", peer, negotiated.scope, negotiated);
  assert.equal(session.localDomain, "domain-b");
  assert.equal(session.peerIdentity.domain, "domain-a");
  assert.equal(session.authenticated, true);
  assert.equal(session.encrypted, false);
  assert.equal(session.negotiated.scope.peerId, "domain-a/workload-a");
});

test("negotiated peer scope must match the authenticated transport identity", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, { ...scope("session-scope-mismatch"), peerId: "domain-a/other-workload" });
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  await expectFederationError(
    () => boundary.open("domain-b", peer, negotiated.scope, negotiated),
    "AUTHENTICATION_FAILURE",
  );
});

test("matching envelope is delivered and preserved", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, scope("session-002"));
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  const session = await boundary.open("domain-b", peer, negotiated.scope, negotiated);
  const result = await boundary.send(session, envelope(), 100, 0);
  assert.equal(result.outcome, "DELIVERED");
  assert.equal(adapter.listReceived().length, 1);
  assert.equal(adapter.listReceived()[0]?.messageId, "msg-001");
});

test("sender/session mismatch fails before provider send", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, scope("session-003"));
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  const session = await boundary.open("domain-b", peer, negotiated.scope, negotiated);
  const bad = { ...envelope(), sender: { ...peer, subject: "other" } };
  await expectFederationError(() => boundary.send(session, bad, 100, 0), "AUTHENTICATION_FAILURE");
  assert.equal(adapter.listReceived().length, 0);
});

test("oversized message is rejected before provider send", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, scope("session-004"));
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  const session = await boundary.open("domain-b", peer, negotiated.scope, negotiated);
  await expectFederationError(() => boundary.send(session, envelope(), 1025, 0), "RESOURCE_EXHAUSTED");
});

test("F3-050: encrypted transport without authenticated peer is still rejected", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, scope("session-050"));
  const encryptedUnauthenticatedAdapter: FederationTransportAdapter = {
    async open(context) {
      return {
        sessionId: context.scope.sessionId,
        localDomain: context.localDomain,
        peerIdentity: { ...context.peer },
        establishedAt: "2026-09-16T06:00:02.000Z",
        encrypted: true,
        authenticated: false,
        negotiated: context.negotiated,
      };
    },
    async send(context) {
      return {
        outcome: "DELIVERED",
        sessionId: context.session.sessionId,
        messageId: context.envelope.messageId,
        idempotencyKey: `${context.envelope.sender.domain}\u0000${context.envelope.replayNonce}`,
        observedAt: "2026-09-16T06:00:02.000Z",
      };
    },
    async close() {},
  };
  const boundary = new FederationTransportBoundary(encryptedUnauthenticatedAdapter);
  await expectFederationError(() => boundary.open("domain-b", peer, negotiated.scope, negotiated), "AUTHENTICATION_FAILURE");
});

test("closed provider session reports peer unavailable", async () => {
  const negotiated = negotiateFederationCapabilities(profile, profile, scope("session-005"));
  const adapter = new InMemoryFederationTransportAdapter("2026-09-16T06:00:02.000Z");
  const boundary = new FederationTransportBoundary(adapter);
  const session = await boundary.open("domain-b", peer, negotiated.scope, negotiated);
  await boundary.close(session);
  const result = await adapter.send({ session, envelope: envelope(), messageSize: 100, attachmentSize: 0 });
  assert.equal(result.outcome, "PEER_UNAVAILABLE");
});
