import test from "node:test";
import assert from "node:assert/strict";
import {
  FEDERATION_PROTOCOL,
  FederationProtocolError,
  FederationLocalAdmission,
  FederationTrustBoundary,
  FederationResourceGovernor,
  InMemoryFederatedInbox,
  InMemoryFederationReconciler,
  PolicyEngine,
  createUnsignedFederationEnvelope,
  federationSigningBytes,
  signFederationEnvelope,
  verifyFederationEnvelope,
  negotiateFederationCapabilities,
  type FederationEnvelope,
  type FederationNegotiationProfile,
  type FederationTrustDecision,
  type TrustedFederationPeer,
  type FederationTrustAnchor,
} from "../src/index.js";

const peerIdentity = {
  domain: "remote-a",
  subject: "workload-a",
  transportBinding: "spiffe://remote-a/workload-a",
};

function envelope(overrides: Partial<FederationEnvelope> = {}): FederationEnvelope {
  const unsigned = createUnsignedFederationEnvelope({
    protocol: FEDERATION_PROTOCOL,
    protocolVersion: "0.1",
    schema: "sif.federation.envelope",
    schemaVersion: "1",
    sender: peerIdentity,
    targetDomain: "local-a",
    messageId: "msg-gap-001",
    eventId: "evt-gap-001",
    provenanceId: "prov-gap-001",
    time: {
      occurredAt: "2026-09-15T23:00:00.000Z",
      observedAt: "2026-09-16T06:00:01.000Z",
      expiresAt: "2026-09-16T07:00:00.000Z",
      semantics: "event-and-observation",
    },
    capabilities: [],
    payload: { type: "evidence", data: { value: 1 } },
    replayNonce: "nonce-gap-001",
  });
  const signed = signFederationEnvelope(unsigned, { sign: (data: string) => `sig:${data}` });
  return { ...signed, ...overrides };
}

const profile: FederationNegotiationProfile = {
  protocolVersions: ["0.1"],
  envelopeVersions: ["1"],
  authenticationModes: ["test-auth"],
  signatureAlgorithms: ["Ed25519"],
  replayModes: ["nonce-v1"],
  reconciliationModes: ["cursor-v1"],
  orderingGuarantees: ["per-stream"],
  maxMessageSize: 1024,
  maxAttachmentSize: 512,
  capabilities: [{ id: "event.observe", version: "1", semantics: "observation-v1" }],
};

const anchor: FederationTrustAnchor = {
  id: "anchor-gap",
  subject: "CN=SIF Gap Test Root",
  status: "active",
  validFrom: "2026-09-16T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
};

const trustedPeer: TrustedFederationPeer = {
  identity: peerIdentity,
  trustAnchorId: anchor.id,
  status: "active",
  allowedTargetDomains: ["local-a"],
};

test("F3-033: delayed remote observation preserves occurrence and observation time semantics", () => {
  const reconciler = new InMemoryFederationReconciler(10);
  const delayed = reconciler.reconcile({
    observations: [{
      sourceDomain: "remote-a",
      observationId: "obs-delayed-001",
      cursor: "0001",
      eventId: "event-delayed-001",
      eventDigest: "digest-delayed-001",
      occurredAt: "2026-09-10T12:00:00.000Z",
      observedAt: "2026-09-16T06:00:01.000Z",
      payload: { value: 1 },
    }],
  });

  assert.equal(delayed.accepted.length, 1);
  assert.equal(delayed.accepted[0]?.occurredAt, "2026-09-10T12:00:00.000Z");
  assert.equal(delayed.accepted[0]?.observedAt, "2026-09-16T06:00:01.000Z");
});

test("F3-036: replaying the same remote cursor batch remains idempotent", () => {
  const reconciler = new InMemoryFederationReconciler(10);
  const observation = {
    sourceDomain: "remote-a",
    observationId: "obs-cursor-001",
    cursor: "0042",
    eventId: "event-cursor-001",
    eventDigest: "digest-cursor-001",
    occurredAt: "2026-09-16T05:00:00.000Z",
    observedAt: "2026-09-16T06:00:01.000Z",
    payload: { value: 42 },
  };
  const first = reconciler.reconcile({ observations: [observation] });
  const replay = reconciler.reconcile({ observations: [observation] });

  assert.equal(first.accepted.length, 1);
  assert.equal(replay.accepted.length, 0);
  assert.equal(replay.duplicates.length, 1);
  assert.equal(replay.nextCursor, "0042");
  assert.equal(reconciler.listObservations().length, 1);
});

test("F3-043: remote provenance cannot create local authority without a local policy rule", () => {
  const admission = new FederationLocalAdmission("local-a", new PolicyEngine());
  const trust: FederationTrustDecision = {
    identity: peerIdentity,
    trustAnchorId: "anchor-gap",
    authenticated: true,
    authorizedForLocalDomain: true,
  };
  const negotiation = negotiateFederationCapabilities(profile, profile, {
    peerId: "remote-a/workload-a",
    sessionId: "gap-session-043",
    protocolVersion: "0.1",
  });
  const msg = envelope({
    capabilities: [{ id: "event.observe", version: "1" }],
    provenanceId: "remote-asserted-elevated-trust",
  });

  assert.throws(
    () => admission.admit({
      envelope: msg,
      trust,
      negotiation,
      capabilityId: "event.observe",
      effectClass: "write-local-state",
      policyVersion: "policy-v1",
      assertedScope: "local-state",
    }),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "AUTHORIZATION_DENIED",
  );
});

test("F3-044: same message identity from a different peer is rejected, not falsely deduplicated", () => {
  const inbox = new InMemoryFederatedInbox();
  const first = envelope();
  inbox.accept(first, "consumer-a", "2026-09-16T06:00:02.000Z");

  const crossPeer = { ...first, sender: { ...first.sender, domain: "remote-b", subject: "workload-b", transportBinding: "spiffe://remote-b/workload-b" } };
  assert.throws(
    () => inbox.accept(crossPeer, "consumer-a", "2026-09-16T06:00:03.000Z"),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "INTEGRITY_FAILURE",
  );
  assert.equal(inbox.get("consumer-a", first.messageId).senderDomain, "remote-a");
});

test("F3-046: provenance tampering is detected by the signed envelope boundary", () => {
  const original = envelope();
  const tampered = { ...original, provenanceId: "prov-tampered" };
  const verifier = { verify: (data: string, signature: string) => signature === `sig:${data}` };

  assert.notEqual(federationSigningBytes(tampered), federationSigningBytes(original));
  assert.throws(
    () => verifyFederationEnvelope(tampered, verifier),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "INVALID_SIGNATURE",
  );
});

test("F3-047: occurrence, observation and inbox receipt times remain distinct facts", () => {
  const inbox = new InMemoryFederatedInbox();
  const msg = envelope();
  const receivedAt = "2026-09-16T06:00:05.000Z";
  const claim = inbox.accept(msg, "consumer-a", receivedAt);

  assert.equal(claim.record.receivedAt, receivedAt);
  assert.equal(msg.time.occurredAt, "2026-09-15T23:00:00.000Z");
  assert.equal(msg.time.observedAt, "2026-09-16T06:00:01.000Z");
  assert.notEqual(claim.record.receivedAt, msg.time.observedAt);
});

test("F3-048: replayed historical message preserves original occurrence semantics", () => {
  const inbox = new InMemoryFederatedInbox();
  const historical = envelope({ messageId: "msg-historical-001", eventId: "evt-historical-001", replayNonce: "nonce-historical-001" });
  const first = inbox.accept(historical, "consumer-a", "2026-09-16T06:30:00.000Z");
  assert.equal(first.accepted, true);
  assert.equal(first.record.receivedAt, "2026-09-16T06:30:00.000Z");

  inbox.markProcessed("consumer-a", historical.messageId, "2026-09-16T06:31:00.000Z");
  inbox.markCommitted("consumer-a", historical.messageId, "result-historical-001", "2026-09-16T06:32:00.000Z");

  const replay = inbox.accept(historical, "consumer-a", "2026-09-16T06:33:00.000Z");
  assert.equal(replay.accepted, false);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.record.state, "COMMITTED");
  assert.equal(replay.record.receivedAt, "2026-09-16T06:30:00.000Z");
  assert.equal(historical.time.occurredAt, "2026-09-15T23:00:00.000Z");
  assert.equal(historical.time.observedAt, "2026-09-16T06:00:01.000Z");
});

test("F3-049: accepted federated evidence preserves source identity, provenance and local policy attribution", () => {
  const policy = new PolicyEngine();
  policy.addRule({
    id: "allow-observation-evidence",
    effect: "allow",
    subject: "remote-a/workload-a",
    capability: "event.observe",
    scopePrefix: "local-evidence",
    reason: "Explicit local policy permits this evidence admission",
  });
  const admission = new FederationLocalAdmission("local-a", policy);
  const trust: FederationTrustDecision = {
    identity: peerIdentity,
    trustAnchorId: anchor.id,
    authenticated: true,
    authorizedForLocalDomain: true,
  };
  const negotiation = negotiateFederationCapabilities(profile, profile, {
    peerId: "remote-a/workload-a",
    sessionId: "gap-session-049",
    protocolVersion: "0.1",
  });
  const msg = envelope({
    messageId: "msg-evidence-049",
    eventId: "evt-evidence-049",
    provenanceId: "prov-evidence-049",
    capabilities: [{ id: "event.observe", version: "1" }],
  });

  const decision = admission.admit({
    envelope: msg,
    trust,
    negotiation,
    capabilityId: "event.observe",
    effectClass: "record-local-evidence",
    policyVersion: "policy-v049",
    assertedScope: "local-evidence/federated",
  });

  assert.equal(decision.peerDomain, "remote-a");
  assert.equal(decision.peerSubject, "workload-a");
  assert.equal(decision.messageId, "msg-evidence-049");
  assert.equal(decision.eventId, "evt-evidence-049");
  assert.equal(decision.provenanceId, "prov-evidence-049");
  assert.equal(decision.policyVersion, "policy-v049");
  assert.equal(decision.ruleId, "allow-observation-evidence");
});

test("F3-031: repeated peer retry/reconnect attempts are bounded by resource admission", () => {
  const limits = {
    maxConcurrentSessions: 2,
    maxOutstandingInboxWork: 2,
    maxReplayEntries: 2,
    maxReconciliationBatch: 2,
    maxPeerRatePerWindow: 2,
    maxGlobalRatePerWindow: 3,
    rateWindowMs: 1000,
  } as const;
  const governor = new FederationResourceGovernor(limits);

  governor.openSession("peer-a", 1000);
  governor.closeSession();
  governor.openSession("peer-a", 1000);
  governor.closeSession();

  assert.throws(
    () => governor.openSession("peer-a", 1000),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED",
  );
  assert.equal(governor.snapshot().peerWindowStarts, 2);
});

test("F3-051: remote domain cannot become local authority by claiming the local domain", () => {
  const boundary = new FederationTrustBoundary("local-a");
  boundary.registerTrustAnchor(anchor);
  assert.throws(
    () => boundary.registerPeer({ ...trustedPeer, identity: { ...peerIdentity, domain: "local-a" } }),
    (error: unknown) => error instanceof FederationProtocolError,
  );
});

test("F3-052: identical reconciliation input produces identical deterministic output", () => {
  const input = {
    observations: [
      {
        sourceDomain: "remote-a",
        observationId: "obs-det-002",
        cursor: "0002",
        eventId: "event-det-002",
        eventDigest: "digest-det-002",
        occurredAt: "2026-09-16T04:00:00.000Z",
        observedAt: "2026-09-16T06:00:02.000Z",
        payload: { value: 2 },
      },
      {
        sourceDomain: "remote-a",
        observationId: "obs-det-001",
        cursor: "0001",
        eventId: "event-det-001",
        eventDigest: "digest-det-001",
        occurredAt: "2026-09-16T03:00:00.000Z",
        observedAt: "2026-09-16T06:00:01.000Z",
        payload: { value: 1 },
      },
    ],
  };
  const a = new InMemoryFederationReconciler(10).reconcile(input);
  const b = new InMemoryFederationReconciler(10).reconcile(input);
  assert.deepEqual(a, b);
});
