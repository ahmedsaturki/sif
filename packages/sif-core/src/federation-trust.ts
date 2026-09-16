import type { ISODate } from "./types.js";
import { FederationProtocolError, type FederationPeerIdentity } from "./federation-envelope.js";

export type TrustAnchorStatus = "active" | "revoked";
export type TrustedPeerStatus = "active" | "revoked";

export interface FederationTrustAnchor {
  id: string;
  subject: string;
  status: TrustAnchorStatus;
  validFrom: ISODate;
  expiresAt?: ISODate;
}

export interface TrustedFederationPeer {
  identity: FederationPeerIdentity;
  trustAnchorId: string;
  status: TrustedPeerStatus;
  allowedTargetDomains: string[];
}

export interface TransportPeerObservation {
  identity: FederationPeerIdentity;
  trustAnchorId: string;
}

export interface FederationTrustDecision {
  identity: FederationPeerIdentity;
  trustAnchorId: string;
  authenticated: true;
  authorizedForLocalDomain: boolean;
}

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
}

function assertDate(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${name} must be a valid ISO date`);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

export class FederationTrustBoundary {
  private readonly anchors = new Map<string, FederationTrustAnchor>();
  private readonly peers = new Map<string, TrustedFederationPeer>();

  constructor(readonly localDomain: string) {
    assertNonEmpty("localDomain", localDomain);
  }

  registerTrustAnchor(anchor: FederationTrustAnchor): void {
    assertNonEmpty("anchor.id", anchor.id);
    assertNonEmpty("anchor.subject", anchor.subject);
    assertDate("anchor.validFrom", anchor.validFrom);
    if (anchor.expiresAt !== undefined) {
      assertDate("anchor.expiresAt", anchor.expiresAt);
      if (Date.parse(anchor.expiresAt) <= Date.parse(anchor.validFrom)) {
        throw new TypeError("anchor.expiresAt must be after anchor.validFrom");
      }
    }
    if (this.anchors.has(anchor.id)) {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Trust anchor already exists: ${anchor.id}`);
    }
    this.anchors.set(anchor.id, { ...anchor });
  }

  registerPeer(peer: TrustedFederationPeer): void {
    validateIdentity(peer.identity);
    assertNonEmpty("peer.trustAnchorId", peer.trustAnchorId);
    if (!this.anchors.has(peer.trustAnchorId)) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Peer references an unknown trust anchor");
    }
    if (peer.identity.domain === this.localDomain) {
      throw new FederationProtocolError("AUTHORIZATION_DENIED", "Remote peer identity cannot claim the local domain");
    }
    const key = peerIdentityKey(peer.identity);
    if (this.peers.has(key)) {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Trusted peer already exists: ${key}`);
    }
    const targets = sortedUnique(peer.allowedTargetDomains);
    if (!targets.includes(this.localDomain)) {
      throw new FederationProtocolError("AUTHORIZATION_DENIED", "Trusted peer must explicitly allow the local domain as a target");
    }
    this.peers.set(key, { ...peer, allowedTargetDomains: targets });
  }

  revokeTrustAnchor(id: string): void {
    const anchor = this.anchors.get(id);
    if (!anchor) throw new FederationProtocolError("AUTHENTICATION_FAILURE", `Unknown trust anchor: ${id}`);
    this.anchors.set(id, { ...anchor, status: "revoked" });
  }

  revokePeer(identity: FederationPeerIdentity): void {
    const key = peerIdentityKey(identity);
    const peer = this.peers.get(key);
    if (!peer) throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Unknown federation peer");
    this.peers.set(key, { ...peer, status: "revoked" });
  }

  authenticate(observation: TransportPeerObservation, observedAt: ISODate): FederationTrustDecision {
    validateIdentity(observation.identity);
    assertNonEmpty("observation.trustAnchorId", observation.trustAnchorId);
    assertDate("observedAt", observedAt);
    if (observation.identity.domain === this.localDomain) {
      throw new FederationProtocolError("AUTHORIZATION_DENIED", "Remote authentication cannot establish local authority");
    }

    const peer = this.peers.get(peerIdentityKey(observation.identity));
    if (!peer) throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Observed peer is not trusted");
    if (peer.status !== "active") throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Trusted peer is revoked");
    if (peer.trustAnchorId !== observation.trustAnchorId) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Observed trust anchor does not match peer binding");
    }

    const anchor = this.anchors.get(observation.trustAnchorId);
    if (!anchor || anchor.status !== "active") {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Trust anchor is not active");
    }
    const observedTime = Date.parse(observedAt);
    if (observedTime < Date.parse(anchor.validFrom)) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Observation predates trust-anchor validity");
    }
    if (anchor.expiresAt !== undefined && observedTime >= Date.parse(anchor.expiresAt)) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Trust anchor is expired");
    }
    if (peer.identity.transportBinding !== observation.identity.transportBinding) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Transport identity binding mismatch");
    }

    return {
      identity: { ...observation.identity },
      trustAnchorId: anchor.id,
      authenticated: true,
      authorizedForLocalDomain: peer.allowedTargetDomains.includes(this.localDomain),
    };
  }
}

function validateIdentity(identity: FederationPeerIdentity): void {
  assertNonEmpty("identity.domain", identity.domain);
  assertNonEmpty("identity.subject", identity.subject);
  assertNonEmpty("identity.transportBinding", identity.transportBinding);
}

function peerIdentityKey(identity: FederationPeerIdentity): string {
  return `${identity.domain}\u0000${identity.subject}`;
}
