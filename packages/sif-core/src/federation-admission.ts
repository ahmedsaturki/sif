import type { PolicyDecision, PolicyEngine } from "./policy.js";
import type { FederationEnvelope } from "./federation-envelope.js";
import { FederationProtocolError } from "./federation-envelope.js";
import type { FederationTrustDecision } from "./federation-trust.js";
import {
  assertFederationNegotiationScope,
  type NegotiatedFederationCapabilities,
} from "./federation-capability.js";

export interface FederationAdmissionRequest {
  envelope: FederationEnvelope;
  trust: FederationTrustDecision;
  negotiation: NegotiatedFederationCapabilities;
  capabilityId: string;
  effectClass: string;
  policyVersion: string;
  assertedScope: string;
}

export interface FederationAdmissionDecision {
  admitted: true;
  peerDomain: string;
  peerSubject: string;
  messageId: string;
  eventId?: string;
  provenanceId: string;
  capabilityId: string;
  effectClass: string;
  policyVersion: string;
  ruleId: string;
  reason: string;
}

export class FederationLocalAdmission {
  constructor(
    private readonly localDomain: string,
    private readonly policy: PolicyEngine,
  ) {
    if (localDomain.length === 0) throw new TypeError("localDomain must not be empty");
  }

  admit(request: FederationAdmissionRequest): FederationAdmissionDecision {
    const { envelope, trust, negotiation } = request;
    assertNonEmpty("capabilityId", request.capabilityId);
    assertNonEmpty("effectClass", request.effectClass);
    assertNonEmpty("policyVersion", request.policyVersion);
    assertNonEmpty("assertedScope", request.assertedScope);

    if (!trust.authenticated) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Federation admission requires an authenticated peer", "peer");
    }
    if (envelope.targetDomain !== this.localDomain) {
      throw new FederationProtocolError("AUTHORIZATION_DENIED", "Federated message does not target the local domain", "authorization");
    }
    if (trust.identity.domain !== envelope.sender.domain || trust.identity.subject !== envelope.sender.subject) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Authenticated peer identity does not match envelope sender", "peer");
    }
    assertFederationNegotiationScope(negotiation, {
      peerId: `${trust.identity.domain}/${trust.identity.subject}`,
      sessionId: negotiation.scope.sessionId,
      protocolVersion: envelope.protocolVersion,
    });

    if (request.capabilityId !== undefined && !negotiation.capabilities.some((capability) => capability.id === request.capabilityId)) {
      throw new FederationProtocolError("CAPABILITY_INCOMPATIBLE", "Requested capability was not negotiated for this session", "authorization");
    }
    if (request.capabilityId && !envelope.capabilities.some((capability) => capability.id === request.capabilityId)) {
      throw new FederationProtocolError("AUTHORIZATION_DENIED", "Envelope did not declare the requested capability", "authorization");
    }

    const input = {
      subjectId: `${trust.identity.domain}/${trust.identity.subject}`,
      capabilityId: request.capabilityId,
      scope: request.assertedScope,
      context: {
        localDomain: this.localDomain,
        effectClass: request.effectClass,
        messageId: envelope.messageId,
        eventId: envelope.eventId,
        provenanceId: envelope.provenanceId,
        senderDomain: envelope.sender.domain,
        senderSubject: envelope.sender.subject,
        negotiatedProtocolVersion: negotiation.protocolVersion,
        negotiatedEnvelopeVersion: negotiation.envelopeVersion,
        policyVersion: request.policyVersion,
      },
    };

    const decision = this.policy.decide(input);
    if (decision.effect !== "allow") {
      throw new FederationProtocolError(
        "AUTHORIZATION_DENIED",
        `Local federation policy denied the requested effect: ${decision.ruleId}: ${decision.reason}`,
        "authorization",
      );
    }

    return {
      admitted: true,
      peerDomain: trust.identity.domain,
      peerSubject: trust.identity.subject,
      messageId: envelope.messageId,
      ...(envelope.eventId === undefined ? {} : { eventId: envelope.eventId }),
      provenanceId: envelope.provenanceId,
      capabilityId: request.capabilityId,
      effectClass: request.effectClass,
      policyVersion: request.policyVersion,
      ruleId: decision.ruleId,
      reason: decision.reason,
    };
  }
}

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
}

export type { PolicyDecision };
