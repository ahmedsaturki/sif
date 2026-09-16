import test from "node:test";
import assert from "node:assert/strict";
import {
  FEDERATION_PROTOCOL,
  FederationProtocolError,
  FederationTransportBoundary,
  InMemoryFederatedInbox,
  InMemoryFederationReconciler,
  InMemoryFederationTransportAdapter,
  classifyFederationRetry,
  createUnsignedFederationEnvelope,
  federationSigningBytes,
  federatedEffectDigest,
  signFederationEnvelope,
  verifyFederationEnvelope,
  negotiateFederationCapabilities,
  type FederationNegotiationProfile,
  type FederationTransportAdapter,
  type FederationTransportOpenContext,
  type FederationTransportResult,
  type FederationTransportSendContext,
  type FederationTransportSession,
  type FederationPeerIdentity,
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

const peer: FederationPeerIdentity = {
  domain: "domain-a",
  subject: "workload-a",
  transportBinding: "spiffe://domain-a/workload-a",
};

const fixedObservedAt = "2026-09-16T06:00:02.000Z";

function envelope(messageId = "msg-fault-001", replayNonce = "nonce-fault-001") {
  return {
    ...createUnsignedFederationEnvelope({
      protocol: FEDERATION_PROTOCOL,
      protocolVersion: "0.1",
      schema: "sif.federation.envelope",
      schemaVersion: "1",
      sender: peer,
      targetDomain: "domain-b",
      messageId,
      eventId: `${messageId}-event`,
      provenanceId: `${messageId}-provenance`,
      time: {
        occurredAt: "2026-09-16T06:00:00.000Z",
        observedAt: "2026-09-16T06:00:01.000Z",
        semantics: "event-and-observation",
      },
      capabilities: [],
      payload: { type: "evidence", data: { value: 1 } },
      replayNonce,
    }),
    signature: "test-signature",
  };
}

function negotiated(sessionId: string) {
  return negotiateFederationCapabilities(profile, profile, {
    peerId: peer.domain,
    sessionId,
    protocolVersion: "0.1",
  });
}

class ForcedAuthenticationFaultAdapter implements FederationTransportAdapter {
  openCalls = 0;

  async open(context: FederationTransportOpenContext): Promise<FederationTransportSession> {
    this.openCalls += 1;
    return {
      sessionId: context.scope.sessionId,
      localDomain: context.localDomain,
      peerIdentity: { ...context.peer },
      establishedAt: fixedObservedAt,
      authenticated: false,
      negotiated: { ...context.negotiated, scope: { ...context.negotiated.scope }, capabilities: [] },
    };
  }

  async send(_context: FederationTransportSendContext): Promise<FederationTransportResult> {
    throw new Error("send must not run after forced authentication fault");
  }

  async close(_session: FederationTransportSession): Promise<void> {}
}

class ForcedOutageThenRecoveryAdapter extends InMemoryFederationTransportAdapter {
  sendCalls = 0;

  override async send(context: FederationTransportSendContext): Promise<FederationTransportResult> {
    this.sendCalls += 1;
    if (this.sendCalls === 1) {
      return {
        outcome: "PEER_UNAVAILABLE",
        sessionId: context.session.sessionId,
        messageId: context.envelope.messageId,
        idempotencyKey: `${context.envelope.sender.domain}\\u0000${context.envelope.replayNonce}`,
        observedAt: fixedObservedAt,
        error: "forced peer outage",
      };
    }
    return super.send(context);
  }
}

class ForcedConnectionLossAfterSendAdapter extends InMemoryFederationTransportAdapter {
  sent = false;

  override async send(context: FederationTransportSendContext): Promise<FederationTransportResult> {
    this.sent = true;
    const delivered = await super.send(context);
    return { ...delivered, outcome: "UNKNOWN_OUTCOME", error: "forced connection loss after peer received message" };
  }
}

test("F3-053: forced authentication fault occurs before transport admission", async () => {
  const adapter = new ForcedAuthenticationFaultAdapter();
  const boundary = new FederationTransportBoundary(adapter);
  const n = negotiated("fault-auth");

  await assert.rejects(
    () => boundary.open("domain-b", peer, n.scope, n),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "AUTHENTICATION_FAILURE",
  );
  assert.equal(adapter.openCalls, 1, "the forced authentication fault must actually execute");
});

test("F3-054: forced signature tamper is detected", () => {
  const unsigned = createUnsignedFederationEnvelope({
    protocol: FEDERATION_PROTOCOL,
    protocolVersion: "0.1",
    schema: "sif.federation.envelope",
    schemaVersion: "1",
    sender: peer,
    targetDomain: "domain-b",
    messageId: "msg-tamper-001",
    eventId: "evt-tamper-001",
    provenanceId: "prov-tamper-001",
    time: {
      occurredAt: "2026-09-16T06:00:00.000Z",
      observedAt: "2026-09-16T06:00:01.000Z",
      semantics: "event-and-observation",
    },
    capabilities: [],
    payload: { type: "evidence", data: { value: 7 } },
    replayNonce: "nonce-tamper-001",
  });

  const signer = { sign: (data: string) => `sig:${data}` };
  const verifier = { verify: (data: string, signature: string) => signature === `sig:${data}` };
  const signed = signFederationEnvelope(unsigned, signer);
  const tampered = { ...signed, signature: `${signed.signature}:tampered` };
  assert.equal(federationSigningBytes(tampered), federationSigningBytes(signed));

  assert.throws(
    () => verifyFederationEnvelope(tampered, verifier),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "INVALID_SIGNATURE",
  );
});

test("F3-055: forced duplicate delivery is actually delivered twice and inbox idempotency contains it", async () => {
  const adapter = new InMemoryFederationTransportAdapter(fixedObservedAt);
  const boundary = new FederationTransportBoundary(adapter);
  const n = negotiated("fault-duplicate");
  const session = await boundary.open("domain-b", peer, n.scope, n);
  const first = await boundary.send(session, envelope(), 100, 0);
  const second = await boundary.send(session, envelope(), 100, 0);
  assert.equal(first.outcome, "DELIVERED");
  assert.equal(second.outcome, "DELIVERED");
  assert.equal(adapter.listReceived().length, 2, "the duplicate fault must actually produce two deliveries");

  const inbox = new InMemoryFederatedInbox();
  const accepted = inbox.accept(envelope(), "consumer-b");
  const duplicate = inbox.accept(envelope(), "consumer-b");
  assert.equal(accepted.accepted, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.accepted, false);
});

test("F3-056: forced peer outage is observed and recovery delivers without changing identity", async () => {
  const adapter = new ForcedOutageThenRecoveryAdapter(fixedObservedAt);
  const boundary = new FederationTransportBoundary(adapter);
  const n = negotiated("fault-outage");
  const session = await boundary.open("domain-b", peer, n.scope, n);
  const msg = envelope("msg-outage-001", "nonce-outage-001");

  const outage = await boundary.send(session, msg, 100, 0);
  assert.equal(outage.outcome, "PEER_UNAVAILABLE");
  assert.match(outage.error ?? "", /forced peer outage/);
  assert.equal(adapter.sendCalls, 1);
  assert.equal(classifyFederationRetry(outage.outcome), "RETRY");

  const recovered = await boundary.send(session, msg, 100, 0);
  assert.equal(recovered.outcome, "DELIVERED");
  assert.equal(recovered.messageId, msg.messageId);
  assert.equal(recovered.idempotencyKey, outage.idempotencyKey);
  assert.equal(adapter.sendCalls, 2);
  assert.equal(adapter.listReceived().length, 1);
});

test("F3-057: forced connection loss after send creates UNKNOWN_OUTCOME and reconciliation resolves it", async () => {
  const adapter = new ForcedConnectionLossAfterSendAdapter(fixedObservedAt);
  const boundary = new FederationTransportBoundary(adapter);
  const n = negotiated("fault-unknown");
  const session = await boundary.open("domain-b", peer, n.scope, n);
  const msg = envelope("msg-unknown-001", "nonce-unknown-001");

  const result = await boundary.send(session, msg, 100, 0);
  assert.equal(adapter.sent, true, "the forced post-send connection loss must execute after actual provider send");
  assert.equal(result.outcome, "UNKNOWN_OUTCOME");
  assert.equal(classifyFederationRetry(result.outcome), "RECONCILE");
  assert.equal(adapter.listReceived().length, 1, "peer-side receipt must exist despite the unknown sender outcome");

  const reconciler = new InMemoryFederationReconciler(10);
  const reconciliation = reconciler.reconcile({
    observations: [
      {
        sourceDomain: peer.domain,
        observationId: "obs-unknown-001",
        cursor: "1",
        eventId: msg.eventId,
        eventDigest: federatedEffectDigest(msg.payload),
        occurredAt: msg.time.occurredAt,
        observedAt: fixedObservedAt,
        payload: { messageId: msg.messageId },
      },
    ],
  });
  assert.equal(reconciliation.accepted.length, 1);
  assert.equal(reconciliation.conflicts.length, 0);
});
