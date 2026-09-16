import test from "node:test";
import assert from "node:assert/strict";
import {
  FEDERATION_PROTOCOL,
  InMemoryFederatedInbox,
  FederationProtocolError,
  type FederationEnvelope,
} from "../src/index.js";

const baseEnvelope: FederationEnvelope = {
  protocol: FEDERATION_PROTOCOL,
  protocolVersion: "0.1",
  schema: "sif.federation.envelope",
  schemaVersion: "1",
  sender: { domain: "domain-a", subject: "workload-a", transportBinding: "spiffe://domain-a/workload-a" },
  targetDomain: "domain-b",
  messageId: "msg-001",
  eventId: "evt-001",
  provenanceId: "prov-001",
  time: {
    occurredAt: "2026-09-16T06:00:00.000Z",
    observedAt: "2026-09-16T06:00:01.000Z",
    expiresAt: "2026-09-16T07:00:00.000Z",
    semantics: "event-and-observation",
  },
  capabilities: [],
  payload: { type: "evidence", data: { value: 1 } },
  replayNonce: "nonce-001",
  payloadDigest: "unused-in-inbox-tests",
  signatureAlgorithm: "Ed25519",
  signature: "test-signature",
};

function withMessage(messageId: string, replayNonce = baseEnvelope.replayNonce): FederationEnvelope {
  return { ...baseEnvelope, messageId, replayNonce };
}

test("duplicate delivery returns the existing record without creating another logical delivery", () => {
  const inbox = new InMemoryFederatedInbox();
  const first = inbox.accept(baseEnvelope, "consumer-a", baseEnvelope.time.observedAt);
  const second = inbox.accept(baseEnvelope, "consumer-a", "2026-09-16T06:00:02.000Z");

  assert.equal(first.accepted, true);
  assert.equal(first.duplicate, false);
  assert.equal(second.accepted, false);
  assert.equal(second.duplicate, true);
  assert.deepEqual(second.record, first.record);
});

test("consumer scope isolates the same message identity", () => {
  const inbox = new InMemoryFederatedInbox();
  const a = inbox.accept(baseEnvelope, "consumer-a");
  const b = inbox.accept(baseEnvelope, "consumer-b");

  assert.equal(a.accepted, true);
  assert.equal(b.accepted, true);
  assert.notEqual(a.record.consumerId, b.record.consumerId);
});

test("replay key cannot be rebound to a distinct message identity", () => {
  const inbox = new InMemoryFederatedInbox();
  inbox.accept(baseEnvelope, "consumer-a");

  assert.throws(
    () => inbox.accept(withMessage("msg-002"), "consumer-a"),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "REPLAY_DETECTED",
  );
});

test("processing state progression is explicit and monotonic", () => {
  const inbox = new InMemoryFederatedInbox();
  inbox.accept(baseEnvelope, "consumer-a");

  const processed = inbox.markProcessed("consumer-a", "msg-001", "2026-09-16T06:00:02.000Z");
  assert.equal(processed.state, "PROCESSED");
  const committed = inbox.markCommitted("consumer-a", "msg-001", "result-001", "2026-09-16T06:00:03.000Z");
  assert.equal(committed.state, "COMMITTED");
  assert.equal(committed.resultDigest, "result-001");
  const verified = inbox.markVerified("consumer-a", "msg-001", "2026-09-16T06:00:04.000Z");
  assert.equal(verified.state, "VERIFIED");
  assert.equal(verified.resultDigest, "result-001");
});

test("invalid state transitions fail closed and cannot skip commitment", () => {
  const inbox = new InMemoryFederatedInbox();
  inbox.accept(baseEnvelope, "consumer-a");

  assert.throws(
    () => inbox.markCommitted("consumer-a", "msg-001", "result-001"),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "INTEGRITY_FAILURE",
  );
  assert.throws(
    () => inbox.markVerified("consumer-a", "msg-001"),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "INTEGRITY_FAILURE",
  );
});

test("committed and verified states are idempotent", () => {
  const inbox = new InMemoryFederatedInbox();
  inbox.accept(baseEnvelope, "consumer-a");
  inbox.markProcessed("consumer-a", "msg-001", "2026-09-16T06:00:02.000Z");
  const committed = inbox.markCommitted("consumer-a", "msg-001", "result-001", "2026-09-16T06:00:03.000Z");
  const committedAgain = inbox.markCommitted("consumer-a", "msg-001", "result-002", "2026-09-16T06:00:05.000Z");
  assert.deepEqual(committedAgain, committed);

  const verified = inbox.markVerified("consumer-a", "msg-001", "2026-09-16T06:00:04.000Z");
  const verifiedAgain = inbox.markVerified("consumer-a", "msg-001", "2026-09-16T06:00:06.000Z");
  assert.deepEqual(verifiedAgain, verified);
});

test("missing inbox identity is typed as replay detection rather than implicit success", () => {
  const inbox = new InMemoryFederatedInbox();
  assert.throws(
    () => inbox.get("consumer-a", "missing-message"),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "REPLAY_DETECTED",
  );
});

test("concurrent deliveries of the same logical message produce one accepted record", async () => {
  const inbox = new InMemoryFederatedInbox();
  const results = await Promise.all(
    Array.from({ length: 16 }, () =>
      Promise.resolve().then(() => inbox.accept(baseEnvelope, "consumer-a")),
    ),
  );

  assert.equal(results.filter((result) => result.accepted).length, 1);
  assert.equal(results.filter((result) => result.duplicate).length, 15);
  assert.deepEqual(inbox.get("consumer-a", "msg-001"), results[0]?.record);
});
