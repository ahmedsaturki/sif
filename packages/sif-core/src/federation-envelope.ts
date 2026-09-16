import { createHash } from "node:crypto";
import type { ISODate } from "./types.js";

export const FEDERATION_PROTOCOL = "sif-federation" as const;
export const FEDERATION_SIGNATURE_ALGORITHM = "Ed25519" as const;

export type FederationFailureCode =
  | "AUTHENTICATION_FAILURE"
  | "AUTHORIZATION_DENIED"
  | "PROTOCOL_INCOMPATIBLE"
  | "CAPABILITY_INCOMPATIBLE"
  | "INVALID_SIGNATURE"
  | "INTEGRITY_FAILURE"
  | "REPLAY_DETECTED"
  | "UNKNOWN_OUTCOME"
  | "TRANSIENT_DELIVERY_FAILURE"
  | "RESOURCE_EXHAUSTED";

export type FederationFailureKind = "peer" | "message" | "delivery" | "authorization";

export class FederationProtocolError extends Error {
  constructor(readonly code: FederationFailureCode, message: string, readonly kind: FederationFailureKind = "message") {
    super(message);
    this.name = "FederationProtocolError";
  }
}

export interface FederationCapability { id: string; version: string; }
export interface FederationPeerIdentity { domain: string; subject: string; transportBinding: string; }
export interface FederationTime {
  occurredAt: ISODate;
  observedAt: ISODate;
  expiresAt?: ISODate;
  semantics: "event-and-observation" | "observation-only" | "control-message";
}
export interface FederationEnvelopePayload { type: string; data: Record<string, unknown>; }

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

/**
 * Crypto remains an adapter boundary. The dependency-free kernel only requires
 * deterministic signing bytes and accepts an implementation-provided signature.
 */
export interface FederationSigner {
  sign(data: string): string;
}
export interface FederationVerifier {
  verify(data: string, signature: string): boolean;
}

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
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function federationPayloadDigest(payload: FederationEnvelopePayload): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

export function canonicalizeFederationEnvelope(envelope: UnsignedFederationEnvelope | FederationEnvelope): string {
  const { signature: _ignoredSignature, ...unsigned } = envelope as FederationEnvelope;
  return JSON.stringify(canonicalize(unsigned));
}

export function federationSigningBytes(envelope: UnsignedFederationEnvelope | FederationEnvelope): string {
  return canonicalizeFederationEnvelope(envelope);
}

export function validateFederationEnvelope(envelope: FederationEnvelope): void {
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
  if (envelope.signatureAlgorithm !== FEDERATION_SIGNATURE_ALGORITHM) {
    throw new FederationProtocolError("PROTOCOL_INCOMPATIBLE", `Unsupported federation signature algorithm: ${envelope.signatureAlgorithm}`);
  }
  assertNonEmpty("signature", envelope.signature);
  assertIso("time.occurredAt", envelope.time.occurredAt);
  assertIso("time.observedAt", envelope.time.observedAt);
  if (envelope.time.expiresAt !== undefined) {
    assertIso("time.expiresAt", envelope.time.expiresAt);
    if (Date.parse(envelope.time.expiresAt) <= Date.parse(envelope.time.observedAt)) throw new TypeError("time.expiresAt must be after time.observedAt");
  }
  if (envelope.eventId !== undefined && envelope.eventId === envelope.messageId) {
    throw new FederationProtocolError("INTEGRITY_FAILURE", "MESSAGE IDENTITY must remain distinct from EVENT IDENTITY");
  }
  if (federationPayloadDigest(envelope.payload) !== envelope.payloadDigest) {
    throw new FederationProtocolError("INTEGRITY_FAILURE", "payloadDigest does not match the canonical payload");
  }
  const canonicalCapabilities = sortCapabilities(envelope.capabilities);
  if (JSON.stringify(canonicalCapabilities) !== JSON.stringify(envelope.capabilities)) {
    throw new FederationProtocolError("INTEGRITY_FAILURE", "capabilities must use deterministic canonical ordering");
  }
}

export function createUnsignedFederationEnvelope(input: Omit<UnsignedFederationEnvelope, "payloadDigest" | "signatureAlgorithm">): UnsignedFederationEnvelope {
  if (input.protocol !== FEDERATION_PROTOCOL) throw new FederationProtocolError("PROTOCOL_INCOMPATIBLE", "Unsupported federation protocol");
  const result: UnsignedFederationEnvelope = {
    ...input,
    capabilities: sortCapabilities(input.capabilities),
    payloadDigest: federationPayloadDigest(input.payload),
    signatureAlgorithm: FEDERATION_SIGNATURE_ALGORITHM,
  };
  validateUnsignedFederationEnvelope(result);
  return result;
}

function validateUnsignedFederationEnvelope(envelope: UnsignedFederationEnvelope): void {
  if (envelope.signatureAlgorithm !== FEDERATION_SIGNATURE_ALGORITHM) {
    throw new FederationProtocolError("PROTOCOL_INCOMPATIBLE", `Unsupported federation signature algorithm: ${envelope.signatureAlgorithm}`);
  }
  if (federationPayloadDigest(envelope.payload) !== envelope.payloadDigest) {
    throw new FederationProtocolError("INTEGRITY_FAILURE", "payloadDigest does not match the canonical payload");
  }
  const signedView = { ...envelope, signature: "unsigned" } as FederationEnvelope;
  validateFederationEnvelope(signedView);
}

export function signFederationEnvelope(envelope: UnsignedFederationEnvelope, signer: FederationSigner): FederationEnvelope {
  validateUnsignedFederationEnvelope(envelope);
  return { ...envelope, signature: signer.sign(federationSigningBytes(envelope)) };
}

export function verifyFederationEnvelope(envelope: FederationEnvelope, verifier: FederationVerifier): void {
  validateFederationEnvelope(envelope);
  if (!verifier.verify(federationSigningBytes(envelope), envelope.signature)) {
    throw new FederationProtocolError("INVALID_SIGNATURE", "Federated envelope signature verification failed");
  }
}
