import type { ISODate } from "./types.js";
import { FederationProtocolError, type FederationEnvelope, type FederationPeerIdentity } from "./federation-envelope.js";
import type { FederationNegotiationScope, NegotiatedFederationCapabilities } from "./federation-capability.js";
import { assertFederationNegotiationScope, assertFederationMessageWithinNegotiatedLimits } from "./federation-capability.js";

export type FederationTransportOutcome =
  | "DELIVERED"
  | "PEER_UNAVAILABLE"
  | "TRANSIENT_DELIVERY_FAILURE"
  | "AUTHENTICATION_FAILURE"
  | "PROTOCOL_INCOMPATIBLE"
  | "CAPABILITY_INCOMPATIBLE"
  | "UNKNOWN_OUTCOME";

export interface FederationTransportSession {
  sessionId: string;
  localDomain: string;
  peerIdentity: FederationPeerIdentity;
  establishedAt: ISODate;
  authenticated: boolean;
  negotiated: NegotiatedFederationCapabilities;
}

export interface FederationTransportSendContext {
  session: FederationTransportSession;
  envelope: FederationEnvelope;
  messageSize: number;
  attachmentSize: number;
}

export interface FederationTransportResult {
  outcome: FederationTransportOutcome;
  sessionId: string;
  messageId: string;
  idempotencyKey: string;
  observedAt: ISODate;
  error?: string;
}

export interface FederationTransportAdapter {
  open(peer: FederationPeerIdentity, scope: FederationNegotiationScope, negotiated: NegotiatedFederationCapabilities): Promise<FederationTransportSession>;
  send(context: FederationTransportSendContext): Promise<FederationTransportResult>;
  close(session: FederationTransportSession): Promise<void>;
}

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
}

function assertIso(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${name} must be a valid ISO date`);
}

function validateSession(session: FederationTransportSession): void {
  assertNonEmpty("session.sessionId", session.sessionId);
  assertNonEmpty("session.localDomain", session.localDomain);
  assertNonEmpty("session.peerIdentity.domain", session.peerIdentity.domain);
  assertNonEmpty("session.peerIdentity.subject", session.peerIdentity.subject);
  assertNonEmpty("session.peerIdentity.transportBinding", session.peerIdentity.transportBinding);
  assertIso("session.establishedAt", session.establishedAt);
  if (!session.authenticated) throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Transport session is not authenticated", "peer");
}

/**
 * Provider-neutral transport boundary. TLS/mTLS/SPIFFE implementations live outside this kernel.
 */
export class FederationTransportBoundary {
  constructor(private readonly adapter: FederationTransportAdapter) {}

  async open(peer: FederationPeerIdentity, scope: FederationNegotiationScope, negotiated: NegotiatedFederationCapabilities): Promise<FederationTransportSession> {
    assertNonEmpty("peer.domain", peer.domain);
    assertNonEmpty("peer.subject", peer.subject);
    assertNonEmpty("peer.transportBinding", peer.transportBinding);
    assertFederationNegotiationScope(negotiated, scope);
    const session = await this.adapter.open(peer, scope, negotiated);
    validateSession(session);
    if (session.peerIdentity.domain !== peer.domain || session.peerIdentity.subject !== peer.subject || session.peerIdentity.transportBinding !== peer.transportBinding) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Transport adapter returned an identity-mismatched session", "peer");
    }
    return { ...session, peerIdentity: { ...session.peerIdentity }, negotiated: { ...session.negotiated, scope: { ...session.negotiated.scope }, capabilities: session.negotiated.capabilities.map((item) => ({ ...item })) } };
  }

  async send(
    session: FederationTransportSession,
    envelope: FederationEnvelope,
    messageSize: number,
    attachmentSize: number,
    scope: FederationNegotiationScope = session.negotiated.scope,
  ): Promise<FederationTransportResult> {
    validateSession(session);
    assertFederationNegotiationScope(session.negotiated, scope);
    if (envelope.sender.domain !== session.peerIdentity.domain || envelope.sender.subject !== session.peerIdentity.subject || envelope.sender.transportBinding !== session.peerIdentity.transportBinding) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Envelope sender does not match the authenticated transport peer", "peer");
    }
    if (envelope.targetDomain !== session.localDomain) {
      throw new FederationProtocolError("AUTHORIZATION_DENIED", "Envelope target is not the local transport domain", "authorization");
    }
    if (envelope.protocolVersion !== session.negotiated.protocolVersion || envelope.schemaVersion !== session.negotiated.envelopeVersion) {
      throw new FederationProtocolError("CAPABILITY_INCOMPATIBLE", "Envelope version is outside the negotiated transport scope", "message");
    }
    if (envelope.signatureAlgorithm !== session.negotiated.signatureAlgorithm) {
      throw new FederationProtocolError("CAPABILITY_INCOMPATIBLE", "Envelope signature algorithm is outside the negotiated transport scope", "message");
    }
    if (!session.negotiated.capabilities.every((capability) => envelope.capabilities.some((offered) => offered.id === capability.id && offered.version === capability.version))) {
      throw new FederationProtocolError("CAPABILITY_INCOMPATIBLE", "Envelope does not carry the negotiated mandatory capability set", "message");
    }
    assertFederationMessageWithinNegotiatedLimits(session.negotiated, messageSize, attachmentSize);

    const result = await this.adapter.send({ session, envelope, messageSize, attachmentSize });
    if (result.sessionId !== session.sessionId || result.messageId !== envelope.messageId || result.idempotencyKey !== `${envelope.sender.domain}\u0000${envelope.replayNonce}`) {
      throw new FederationProtocolError("INTEGRITY_FAILURE", "Transport adapter returned an identity-mismatched delivery result", "delivery");
    }
    assertIso("result.observedAt", result.observedAt);
    return { ...result };
  }

  async close(session: FederationTransportSession): Promise<void> {
    validateSession(session);
    await this.adapter.close(session);
  }
}

export class InMemoryFederationTransportAdapter implements FederationTransportAdapter {
  private readonly sessions = new Map<string, FederationTransportSession>();
  private readonly received: FederationEnvelope[] = [];

  constructor(private readonly observedAt: ISODate = new Date(0).toISOString()) {
    assertIso("observedAt", observedAt);
  }

  async open(peer: FederationPeerIdentity, scope: FederationNegotiationScope, negotiated: NegotiatedFederationCapabilities): Promise<FederationTransportSession> {
    assertFederationNegotiationScope(negotiated, scope);
    const session: FederationTransportSession = {
      sessionId: scope.sessionId,
      localDomain: negotiated.scope.peerId === peer.domain ? "local" : scope.peerId,
      peerIdentity: { ...peer },
      establishedAt: this.observedAt,
      authenticated: true,
      negotiated: { ...negotiated, scope: { ...negotiated.scope }, capabilities: negotiated.capabilities.map((item) => ({ ...item })) },
    };
    this.sessions.set(session.sessionId, session);
    return { ...session, peerIdentity: { ...session.peerIdentity }, negotiated: { ...session.negotiated, scope: { ...session.negotiated.scope }, capabilities: session.negotiated.capabilities.map((item) => ({ ...item })) } };
  }

  async send(context: FederationTransportSendContext): Promise<FederationTransportResult> {
    const active = this.sessions.get(context.session.sessionId);
    if (!active) return { outcome: "PEER_UNAVAILABLE", sessionId: context.session.sessionId, messageId: context.envelope.messageId, idempotencyKey: `${context.envelope.sender.domain}\u0000${context.envelope.replayNonce}`, observedAt: this.observedAt };
    this.received.push({ ...context.envelope, sender: { ...context.envelope.sender }, payload: { type: context.envelope.payload.type, data: { ...context.envelope.payload.data } }, capabilities: context.envelope.capabilities.map((item) => ({ ...item })), time: { ...context.envelope.time } });
    return { outcome: "DELIVERED", sessionId: active.sessionId, messageId: context.envelope.messageId, idempotencyKey: `${context.envelope.sender.domain}\u0000${context.envelope.replayNonce}`, observedAt: this.observedAt };
  }

  async close(session: FederationTransportSession): Promise<void> {
    this.sessions.delete(session.sessionId);
  }

  listReceived(): FederationEnvelope[] {
    return this.received.map((envelope) => ({ ...envelope, sender: { ...envelope.sender }, payload: { type: envelope.payload.type, data: { ...envelope.payload.data } }, capabilities: envelope.capabilities.map((item) => ({ ...item })), time: { ...envelope.time } }));
  }
}
