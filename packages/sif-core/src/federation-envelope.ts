import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import type { KeyObject } from "node:crypto";
import type { ISODate } from "./types.js";

export const FEDERATION_PROTOCOL = "sif-federation" as const;
export const FEDERATION_SIGNATURE_ALGORITHM = "Ed25519" as const;

export type FederationFailureCode =
  | "AUTHENTICATION_FAILURE"
  | "AUTHORIZATION_DENIED"
  | "PROTOCOL_INCOMPATIBLE"
  | "INVALID_SIGNATURE"
  | "INTEGRITY_FAILURE"
  | "REPLAY_DETECTED"
  | "UNKNOWN_OUTCOME"
  | "TRANSIENT_DELIVERY_FAILURE";

export type FederationFailureKind = "peer" | "message" | "delivery" | "authorization";

export class FederationProtocolError extends Error {
  constructor(
    readonly code: FederationFailureCode,
    message: string,
    readonly kind: FederationFailureKind = "message",
  ) {
    super(message);
    this.name = "FederationProtocolError";
  }
}

export interface FederationCapability {
  id: string;
  version: string;
}

export interface FederationPeerIdentity {
  domain: string;
  subject: string;
  transportBinding: string;
}

export interface FederationTime {
  occurredAt: ISODate;
  observedAt: ISODate;
  expiresAt?: ISODate;
  semantics: "event-and-observation" | "observation-only" | "control-message";
}

export interface FederationEnvelopePayload {
  type: string;
  data: Record<string, unknown>;
}

export interface FederationEnvelope {
  protocol: typeof FEDERATION_PROTOCOL;
  protocolVersion: string;
  schema: string;
  schemaVersion: string;
  sender: FederationPeerIdentity;
  targetDomain: string;
  messageId: string;
  eventId?: string;
  correlationId?: string;
  provenanceId: string;
  time: FederationTime;
  capabilities: FederationCapability[];
  payload: FederationEnvelopePayload;
  replayNonce: string;
  payloadDigest: string;
  signatureAlgorithm: typeof FEDERATION_SIGNATURE_ALGORITHM;
  signature: string;
}

export type UnsignedFederationEnvelope = Omit<FederationEnvelope, "signature">;

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
}

function assertIso(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${name} must be a valid ISO date`);
}

function sortCapabilities(capabilities: FederationCapability[]): FederationCapability[] {
  return capabilities
    .map((capability) => ({ id: capability.id, version: capability.version }))
    .sort((a, b) => a.id === b.id ? (a.version < b.version ? -1 : a.version > b.version ? 1 : 0) : (a.id < b.id ? -1 : 1));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function validateFederationEnvelope(envelope: FederationEnvelope | UnsignedFederationEnvelope): void {
  assertNonEmpty("protocolVersion", envelope.protocolVersion);
  assertNonEmpty("schema", envelope.schema);
  assertNonEmpty("schemaVersion", envelope.schemaVersion);
  assertNonEmpty("sender.domain", envelope.sender.domain);
  assertNonEmpty("sender.subject", envelope.sender.subject);
  assertNonEmpty("sender.transportBinding", envelope.sender.transportBinding);
  assertNonEmpty("targetDomain", envelope.targetDomain);
  assertNonEmpty("messageId", envelope.messageId);
  assertNonEmpty("provenanceId", envelope.provenanceId);
  assertNonEmpty("replayNonce", envelope.replayNonce);
  assertNonEmpty("payload.type", envelope.payload.type);
  assertNonEmpty("signatureAlgorithm", envelope.signatureAlgorithm);
  assertIso("time.occurredAt", envelope.time.occurredAt);
  assertIso("time.observedAt", envelope.time.observedAt);
  if (envelope.time.expiresAt !== undefined) assertIso("time.expiresAt", envelope.time.expiresAt);
  if (envelope.time.expiresAt !== undefined && Date.parse(envelope.time.expiresAt) <= Date.parse(envelope.time.observedAt)) {
    throw new TypeError("time.expiresAt must be after time.observedAt");
  }
  if (envelope.eventId !== undefined && envelope.eventId === envelope.messageId) {
    throw new FederationProtocolError("INTEGRITY_FAILURE", "MESSAGE IDENTITY must remain distinct from EVENT IDENTITY");
  }
  const expectedPayloadDigest = createHash("sha256").update(Buffer.from(JSON.stringify(canonicalize(envelope.payload)), "utf8")).digest("hex");
  if (expectedPayloadDigest !== envelope.payloadDigest) {
    throw new FederationProtocolError("INTEGRITY_FAILURE", "payloadDigest does not match the canonical payload");
  }
  const capabilities = sortCapabilities(envelope.capabilities);
  if (JSON.stringify(capabilities) !== JSON.stringify(envelope.capabilities)) {
    throw new FederationProtocolError("INTEGRITY_FAILURE", "capabilities must use deterministic canonical ordering");
  }
  assertNonEmpty("signature", envelope.signature);
}

export function canonicalizeFederationEnvelope(envelope: UnsignedFederationEnvelope | FederationEnvelope): string {
  const unsigned = {
    ...envelope,
    signature: undefined,
  };
  delete (unsigned as Partial<FederationEnvelope>).signature;
  return JSON.stringify(canonicalize(unsigned));
}

export function federationSigningBytes(envelope: UnsignedFederationEnvelope | FederationEnvelope): Buffer {
  return Buffer.from(canonicalizeFederationEnvelope(envelope), "utf8");
}

export function federationPayloadDigest(payload: FederationEnvelopePayload): string {
  return createHash("sha256").update(Buffer.from(JSON.stringify(canonicalize(payload)), "utf8")).digest("hex");
}

export function signFederationEnvelope(envelope: UnsignedFederationEnvelope, privateKey: KeyObject | string | Buffer): FederationEnvelope {
  validateUnsignedEnvelope(envelope);
  const signature = sign(null, federationSigningBytes(envelope), typeof privateKey === "string" ? createPrivateKey(privateKey) : privateKey).toString("base64url");
  return { ...envelope, signature };
}

export function verifyFederationEnvelope(envelope: FederationEnvelope, publicKey: KeyObject | string | Buffer): void {
  validateFederationEnvelope(envelope);
  const key = typeof publicKey === "string" ? createPublicKey(publicKey) : publicKey;
  const valid = verify(null, federationSigningBytes(envelope), key, Buffer.from(envelope.signature, "base64url"));
  if (!valid) throw new FederationProtocolError("INVALID_SIGNATURE", "Federated envelope signature verification failed");
}

function validateUnsignedEnvelope(envelope: UnsignedFederationEnvelope): void {
  if (envelope.signatureAlgorithm !== FEDERATION_SIGNATURE_ALGORITHM) {
    throw new FederationProtocolError("PROTOCOL_INCOMPATIBLE", `Unsupported federation signature algorithm: ${envelope.signatureAlgorithm}`);
  }
  const expectedPayloadDigest = federationPayloadDigest(envelope.payload);
  if (expectedPayloadDigest !== envelope.payloadDigest) {
    throw new FederationProtocolError("INTEGRITY_FAILURE", "payloadDigest does not match the canonical payload");
  }
  validateFederationEnvelope({ ...envelope, signature: "_unsigned_" });
}

export function createUnsignedFederationEnvelope(input: Omit<UnsignedFederationEnvelope, "payloadDigest" | "signatureAlgorithm">): UnsignedFederationEnvelope {
  if (input.protocol !== FEDERATION_PROTOCOL) throw new FederationProtocolError("PROTOCOL_INCOMPATIBLE", "Unsupported federation protocol");
  return {
    ...input,
    capabilities: sortCapabilities(input.capabilities),
    payloadDigest: federationPayloadDigest(input.payload),
    signatureAlgorithm: FEDERATION_SIGNATURE_ALGORITHM,
  };
}
