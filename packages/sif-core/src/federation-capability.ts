import { FederationProtocolError } from "./federation-envelope.js";

export interface FederationCapabilityOffer {
  id: string;
  version: string;
  semantics: string;
  mandatory?: boolean;
}

export interface FederationNegotiationProfile {
  protocolVersions: string[];
  envelopeVersions: string[];
  authenticationModes: string[];
  signatureAlgorithms: string[];
  replayModes: string[];
  reconciliationModes: string[];
  orderingGuarantees: string[];
  maxMessageSize: number;
  maxAttachmentSize: number;
  capabilities: FederationCapabilityOffer[];
}

export interface FederationNegotiationScope {
  peerId: string;
  sessionId: string;
  protocolVersion: string;
}

export interface NegotiatedFederationCapability {
  id: string;
  version: string;
  semantics: string;
}

export interface NegotiatedFederationCapabilities {
  scope: FederationNegotiationScope;
  protocolVersion: string;
  envelopeVersion: string;
  authenticationMode: string;
  signatureAlgorithm: string;
  replayMode: string;
  reconciliationMode: string;
  orderingGuarantee: string;
  maxMessageSize: number;
  maxAttachmentSize: number;
  capabilities: NegotiatedFederationCapability[];
}

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive safe integer`);
  }
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

function validateList(name: string, values: string[]): void {
  if (values.length === 0) throw new FederationProtocolError("CAPABILITY_INCOMPATIBLE", `${name} must not be empty`, "message");
  for (const value of values) assertNonEmpty(`${name} entry`, value);
}

function validateProfile(name: string, profile: FederationNegotiationProfile): void {
  validateList(`${name}.protocolVersions`, profile.protocolVersions);
  validateList(`${name}.envelopeVersions`, profile.envelopeVersions);
  validateList(`${name}.authenticationModes`, profile.authenticationModes);
  validateList(`${name}.signatureAlgorithms`, profile.signatureAlgorithms);
  validateList(`${name}.replayModes`, profile.replayModes);
  validateList(`${name}.reconciliationModes`, profile.reconciliationModes);
  validateList(`${name}.orderingGuarantees`, profile.orderingGuarantees);
  assertPositiveInteger(`${name}.maxMessageSize`, profile.maxMessageSize);
  assertPositiveInteger(`${name}.maxAttachmentSize`, profile.maxAttachmentSize);
  const seen = new Set<string>();
  for (const capability of profile.capabilities) {
    assertNonEmpty(`${name}.capability.id`, capability.id);
    assertNonEmpty(`${name}.capability.version`, capability.version);
    assertNonEmpty(`${name}.capability.semantics`, capability.semantics);
    const key = `${capability.id}\u0000${capability.version}`;
    if (seen.has(key)) {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Duplicate capability offer: ${capability.id}@${capability.version}`);
    }
    seen.add(key);
  }
}

function commonValue(name: string, local: string[], remote: string[]): string {
  const intersection = sortedUnique(local.filter((value) => remote.includes(value)));
  const selected = intersection[intersection.length - 1];
  if (!selected) {
    throw new FederationProtocolError("CAPABILITY_INCOMPATIBLE", `No compatible ${name}`, "message");
  }
  return selected;
}

function capabilityKey(capability: FederationCapabilityOffer): string {
  return `${capability.id}\u0000${capability.version}`;
}

function negotiateCapabilities(
  local: FederationCapabilityOffer[],
  remote: FederationCapabilityOffer[],
): NegotiatedFederationCapability[] {
  const remoteByKey = new Map(remote.map((capability) => [capabilityKey(capability), capability]));
  const localByKey = new Map(local.map((capability) => [capabilityKey(capability), capability]));
  const keys = sortedUnique([
    ...local.filter((capability) => capability.mandatory).map(capabilityKey),
    ...remote.filter((capability) => capability.mandatory).map(capabilityKey),
    ...local.map(capabilityKey).filter((key) => remoteByKey.has(key)),
  ]);

  const negotiated: NegotiatedFederationCapability[] = [];
  for (const key of keys) {
    const localCapability = localByKey.get(key);
    const remoteCapability = remoteByKey.get(key);
    if (!localCapability || !remoteCapability) {
      const mandatoryOwner = localCapability?.mandatory ? "local" : "remote";
      throw new FederationProtocolError("CAPABILITY_INCOMPATIBLE", `Mandatory capability is unsupported by ${mandatoryOwner === "local" ? "remote" : "local"} peer: ${key.replace(/\u0000/g, "@")}`, "message");
    }
    if (localCapability.semantics !== remoteCapability.semantics) {
      throw new FederationProtocolError("CAPABILITY_INCOMPATIBLE", `Capability semantics are incompatible: ${key.replace(/\u0000/g, "@")} `, "message");
    }
    negotiated.push({ id: localCapability.id, version: localCapability.version, semantics: localCapability.semantics });
  }
  return negotiated;
}

function validateScope(scope: FederationNegotiationScope): void {
  assertNonEmpty("scope.peerId", scope.peerId);
  assertNonEmpty("scope.sessionId", scope.sessionId);
  assertNonEmpty("scope.protocolVersion", scope.protocolVersion);
}

export function negotiateFederationCapabilities(
  local: FederationNegotiationProfile,
  remote: FederationNegotiationProfile,
  scope: FederationNegotiationScope,
): NegotiatedFederationCapabilities {
  validateProfile("local", local);
  validateProfile("remote", remote);
  validateScope(scope);

  const protocolVersion = commonValue("protocol version", local.protocolVersions, remote.protocolVersions);
  if (scope.protocolVersion !== protocolVersion) {
    throw new FederationProtocolError("CAPABILITY_INCOMPATIBLE", "Negotiation scope protocol version does not match selected protocol version", "message");
  }

  const result: NegotiatedFederationCapabilities = {
    scope: { ...scope },
    protocolVersion,
    envelopeVersion: commonValue("envelope version", local.envelopeVersions, remote.envelopeVersions),
    authenticationMode: commonValue("authentication mode", local.authenticationModes, remote.authenticationModes),
    signatureAlgorithm: commonValue("signature algorithm", local.signatureAlgorithms, remote.signatureAlgorithms),
    replayMode: commonValue("replay mode", local.replayModes, remote.replayModes),
    reconciliationMode: commonValue("reconciliation mode", local.reconciliationModes, remote.reconciliationModes),
    orderingGuarantee: commonValue("ordering guarantee", local.orderingGuarantees, remote.orderingGuarantees),
    maxMessageSize: Math.min(local.maxMessageSize, remote.maxMessageSize),
    maxAttachmentSize: Math.min(local.maxAttachmentSize, remote.maxAttachmentSize),
    capabilities: negotiateCapabilities(local.capabilities, remote.capabilities),
  };

  return result;
}

export function assertFederationNegotiationScope(
  negotiated: NegotiatedFederationCapabilities,
  scope: FederationNegotiationScope,
): void {
  validateScope(scope);
  if (
    negotiated.scope.peerId !== scope.peerId ||
    negotiated.scope.sessionId !== scope.sessionId ||
    negotiated.scope.protocolVersion !== scope.protocolVersion
  ) {
    throw new FederationProtocolError("CAPABILITY_INCOMPATIBLE", "Negotiated capability scope does not match the active peer session", "message");
  }
}

export function assertFederationMessageWithinNegotiatedLimits(
  negotiated: NegotiatedFederationCapabilities,
  messageSize: number,
  attachmentSize: number,
): void {
  assertPositiveInteger("messageSize", messageSize);
  if (!Number.isSafeInteger(attachmentSize) || attachmentSize < 0) {
    throw new TypeError("attachmentSize must be a non-negative safe integer");
  }
  if (messageSize > negotiated.maxMessageSize) {
    throw new FederationProtocolError("RESOURCE_EXHAUSTED", "Federated message exceeds negotiated maximum size", "message");
  }
  if (attachmentSize > negotiated.maxAttachmentSize) {
    throw new FederationProtocolError("RESOURCE_EXHAUSTED", "Federated attachment exceeds negotiated maximum size", "message");
  }
}
