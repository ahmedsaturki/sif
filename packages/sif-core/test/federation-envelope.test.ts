import test from "node:test";
import assert from "node:assert/strict";
import { digest } from "../src/core.js";
import {
  FEDERATION_PROTOCOL,
  FEDERATION_CANONICALIZATION_VERSION,
  FEDERATION_SIGNATURE_ENCODING,
  FederationProtocolError,
  createUnsignedFederationEnvelope,
  federationPayloadDigest,
  canonicalizeFederationEnvelope,
  signFederationEnvelope,
  verifyFederationEnvelope,
} from "../src/federation-envelope.js";

type BuildInput = Parameters<typeof createUnsignedFederationEnvelope>[0];

function input(overrides: Partial<BuildInput> = {}): BuildInput {
  return {
    protocol: FEDERATION_PROTOCOL,
    protocolVersion: "0.1",
    schema: "sif.federation.envelope",
    schemaVersion: "1",
    sender: { domain: "domain-a", subject: "workload-a", transportBinding: "spiffe://domain-a/workload-a" },
    targetDomain: "domain-b",
    messageId: "msg-001",
    eventId: "evt-001",
    correlationId: "corr-001",
    provenanceId: "prov-001",
    time: { occurredAt: "2026-09-16T06:00:00.000Z", observedAt: "2026-09-16T06:00:01.000Z", expiresAt: "2026-09-16T07:00:00.000Z", semantics: "event-and-observation" },
    capabilities: [{ id: "evidence.read", version: "1" }, { id: "event.write", version: "1" }],
    payload: { type: "evidence", data: { z: 2, a: { y: 1, x: 3 } } },
    replayNonce: "nonce-001",
    ...overrides,
  };
}

const signer = { sign: (data: string) => digest({ purpose: "test-only", data }) };
const verifier = { verify: (data: string, signature: string) => signature === digest({ purpose: "test-only", data }) };

test("canonical payload digest is independent of object insertion order", () => {
  const a = { type: "t", data: { z: 2, a: 1 } };
  const b = { data: { a: 1, z: 2 }, type: "t" };
  assert.equal(federationPayloadDigest(a), federationPayloadDigest(b));
});

test("canonical envelope ordering is deterministic", () => {
  const a = createUnsignedFederationEnvelope(input());
  const b = createUnsignedFederationEnvelope(input({ payload: { data: { a: { x: 3, y: 1 }, z: 2 }, type: "evidence" } }));
  assert.equal(canonicalizeFederationEnvelope(a), canonicalizeFederationEnvelope(b));
});

test("signing contract metadata is explicit and signed", () => {
  const unsigned = createUnsignedFederationEnvelope(input());
  assert.equal(unsigned.canonicalizationVersion, FEDERATION_CANONICALIZATION_VERSION);
  assert.equal(unsigned.signatureEncoding, FEDERATION_SIGNATURE_ENCODING);
  assert.equal(unsigned.keyId, unsigned.sender.transportBinding);

  const signed = signFederationEnvelope(unsigned, signer);
  assert.throws(
    () => verifyFederationEnvelope({ ...signed, keyId: "different-key" }, verifier),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "INVALID_SIGNATURE",
  );
  assert.throws(
    () => verifyFederationEnvelope({ ...signed, canonicalizationVersion: "other" as typeof FEDERATION_CANONICALIZATION_VERSION }, verifier),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "PROTOCOL_INCOMPATIBLE",
  );
  assert.throws(
    () => verifyFederationEnvelope({ ...signed, signatureEncoding: "hex" as typeof FEDERATION_SIGNATURE_ENCODING }, verifier),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "PROTOCOL_INCOMPATIBLE",
  );
});

test("provider-neutral signature verifies and tampering is rejected", () => {
  const signed = signFederationEnvelope(createUnsignedFederationEnvelope(input()), signer);
  assert.doesNotThrow(() => verifyFederationEnvelope(signed, verifier));
  const tampered = { ...signed, payload: { ...signed.payload, data: { ...signed.payload.data, z: 999 } } };
  assert.throws(() => verifyFederationEnvelope(tampered, verifier), FederationProtocolError);
});

test("message identity cannot equal event identity", () => {
  const bad = input({ messageId: "same-id", eventId: "same-id" });
  assert.throws(() => createUnsignedFederationEnvelope(bad), FederationProtocolError);
});

test("F3-008: missing mandatory federation envelope field fails closed", () => {
  const malformed = input({ messageId: "" });
  assert.throws(() => createUnsignedFederationEnvelope(malformed), TypeError);
});

test("F3-010: distinct event identities remain distinct even when transported by related messages", () => {
  const a = createUnsignedFederationEnvelope(input({ messageId: "msg-a", eventId: "evt-a", replayNonce: "nonce-a" }));
  const b = createUnsignedFederationEnvelope(input({ messageId: "msg-b", eventId: "evt-b", replayNonce: "nonce-b" }));
  assert.notEqual(a.messageId, b.messageId);
  assert.notEqual(a.eventId, b.eventId);
  assert.equal(a.correlationId, b.correlationId);
});

test("F3-011: signed content modification fails integrity/signature verification", () => {
  const signed = signFederationEnvelope(createUnsignedFederationEnvelope(input()), signer);
  const tampered = { ...signed, payload: { ...signed.payload, data: { ...signed.payload.data, a: 777 } } };
  assert.throws(() => verifyFederationEnvelope(tampered, verifier), FederationProtocolError);
});

test("F3-012: invalid signature fails closed", () => {
  const signed = signFederationEnvelope(createUnsignedFederationEnvelope(input()), signer);
  assert.throws(() => verifyFederationEnvelope({ ...signed, signature: "invalid-signature" }, verifier), FederationProtocolError);
});

test("F3-013: valid signature cannot be reused with a changed declared sender", () => {
  const signed = signFederationEnvelope(createUnsignedFederationEnvelope(input()), signer);
  const wrongSender = { ...signed, sender: { ...signed.sender, subject: "different-workload" } };
  assert.throws(() => verifyFederationEnvelope(wrongSender, verifier), FederationProtocolError);
});

test("unsupported protocol and signature algorithm fail closed", () => {
  assert.throws(() => createUnsignedFederationEnvelope(input({ protocol: "other" as typeof FEDERATION_PROTOCOL })), FederationProtocolError);
  const unsigned = createUnsignedFederationEnvelope(input());
  const incompatible = { ...unsigned, signatureAlgorithm: "RSA-SHA256" as "Ed25519", signature: "x" };
  assert.throws(() => verifyFederationEnvelope(incompatible, verifier), FederationProtocolError);
});

test("expiry must be after observation time", () => {
  assert.throws(() => createUnsignedFederationEnvelope(input({ time: { ...input().time, expiresAt: "2026-09-16T05:59:59.000Z" } })), TypeError);
});
