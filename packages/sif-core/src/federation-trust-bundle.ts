import type { ISODate } from "./types.js";
import { FederationProtocolError } from "./federation-envelope.js";

export type TrustBundleLifecycle = "registered" | "active" | "retired";

export interface FederationTrustBundleAnchor {
  id: string;
  subject: string;
  validFrom: ISODate;
  expiresAt?: ISODate;
}

export interface FederationTrustBundleInput {
  id: string;
  version: string;
  issuer: string;
  provenanceId: string;
  validFrom: ISODate;
  expiresAt?: ISODate;
  anchors: FederationTrustBundleAnchor[];
}

export interface FederationTrustBundle extends FederationTrustBundleInput {
  status: TrustBundleLifecycle;
  activatedAt?: ISODate;
  retiredAt?: ISODate;
}

export interface FederationTrustBundleRef {
  id: string;
  version: string;
}

export interface FederationTrustBundleResolution {
  bundle: FederationTrustBundle;
  anchor: FederationTrustBundleAnchor;
}

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
}

function assertDate(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${name} must be a valid ISO date`);
}

function keyOf(ref: FederationTrustBundleRef): string {
  return `${ref.id}\u0000${ref.version}`;
}

function validateAnchor(anchor: FederationTrustBundleAnchor): void {
  assertNonEmpty("anchor.id", anchor.id);
  assertNonEmpty("anchor.subject", anchor.subject);
  assertDate("anchor.validFrom", anchor.validFrom);
  if (anchor.expiresAt !== undefined) {
    assertDate("anchor.expiresAt", anchor.expiresAt);
    if (Date.parse(anchor.expiresAt) <= Date.parse(anchor.validFrom)) {
      throw new TypeError("anchor.expiresAt must be after anchor.validFrom");
    }
  }
}

function validateBundle(input: FederationTrustBundleInput): void {
  assertNonEmpty("bundle.id", input.id);
  assertNonEmpty("bundle.version", input.version);
  assertNonEmpty("bundle.issuer", input.issuer);
  assertNonEmpty("bundle.provenanceId", input.provenanceId);
  assertDate("bundle.validFrom", input.validFrom);
  if (input.expiresAt !== undefined) {
    assertDate("bundle.expiresAt", input.expiresAt);
    if (Date.parse(input.expiresAt) <= Date.parse(input.validFrom)) {
      throw new TypeError("bundle.expiresAt must be after bundle.validFrom");
    }
  }
  if (input.anchors.length === 0) {
    throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Trust bundle must contain at least one trust anchor", "peer");
  }
  const ids = new Set<string>();
  for (const anchor of input.anchors) {
    validateAnchor(anchor);
    if (ids.has(anchor.id)) {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Duplicate trust anchor in bundle: ${anchor.id}`);
    }
    ids.add(anchor.id);
  }
}

function isWithinWindow(validFrom: ISODate, expiresAt: ISODate | undefined, at: ISODate): boolean {
  const time = Date.parse(at);
  if (time < Date.parse(validFrom)) return false;
  return expiresAt === undefined || time < Date.parse(expiresAt);
}

export class FederationTrustBundleRegistry {
  private readonly bundles = new Map<string, FederationTrustBundle>();

  register(input: FederationTrustBundleInput): FederationTrustBundleRef {
    validateBundle(input);
    const ref = { id: input.id, version: input.version };
    if (this.bundles.has(keyOf(ref))) {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Trust bundle version already exists: ${input.id}@${input.version}`);
    }
    const snapshot: FederationTrustBundle = {
      ...input,
      anchors: input.anchors.map((anchor) => ({ ...anchor })),
      status: "registered",
    };
    this.bundles.set(keyOf(ref), snapshot);
    return { ...ref };
  }

  get(ref: FederationTrustBundleRef): FederationTrustBundle {
    const bundle = this.bundles.get(keyOf(ref));
    if (!bundle) throw new FederationProtocolError("AUTHENTICATION_FAILURE", `Unknown trust bundle: ${ref.id}@${ref.version}`, "peer");
    return cloneBundle(bundle);
  }

  activate(ref: FederationTrustBundleRef, effectiveAt: ISODate): void {
    assertDate("effectiveAt", effectiveAt);
    const bundle = this.getMutable(ref);
    if (bundle.status === "retired") {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Retired trust bundle cannot be activated: ${ref.id}@${ref.version}`);
    }
    if (!isWithinWindow(bundle.validFrom, bundle.expiresAt, effectiveAt)) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", "Trust bundle activation time is outside its validity window", "peer");
    }
    const overlapping = [...this.bundles.values()].filter((candidate) => {
      if (candidate.status !== "active") return false;
      if (candidate.issuer !== bundle.issuer) return false;
      if (keyOf(candidate) === keyOf(bundle)) return false;
      return isWithinWindow(candidate.validFrom, candidate.expiresAt, effectiveAt);
    });
    if (overlapping.length > 0) {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Trust bundle activation would create overlapping active issuer trust: ${bundle.issuer}`);
    }
    bundle.status = "active";
    bundle.activatedAt = effectiveAt;
  }

  retire(ref: FederationTrustBundleRef, retiredAt: ISODate): void {
    assertDate("retiredAt", retiredAt);
    const bundle = this.getMutable(ref);
    if (bundle.status === "retired") {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Trust bundle is already retired: ${ref.id}@${ref.version}`);
    }
    if (Date.parse(retiredAt) < Date.parse(bundle.validFrom)) {
      throw new TypeError("retiredAt must not precede bundle.validFrom");
    }
    if (bundle.activatedAt !== undefined && Date.parse(retiredAt) < Date.parse(bundle.activatedAt)) {
      throw new TypeError("retiredAt must not precede bundle.activatedAt");
    }
    bundle.status = "retired";
    bundle.retiredAt = retiredAt;
  }

  resolve(issuer: string, anchorId: string, observedAt: ISODate): FederationTrustBundleResolution {
    assertNonEmpty("issuer", issuer);
    assertNonEmpty("anchorId", anchorId);
    assertDate("observedAt", observedAt);

    const candidates = [...this.bundles.values()].filter((bundle) => {
      if (bundle.status !== "active") return false;
      if (bundle.issuer !== issuer) return false;
      if (bundle.retiredAt !== undefined && Date.parse(observedAt) >= Date.parse(bundle.retiredAt)) return false;
      if (!isWithinWindow(bundle.validFrom, bundle.expiresAt, observedAt)) return false;
      return bundle.anchors.some((anchor) => {
        if (anchor.id !== anchorId) return false;
        return isWithinWindow(anchor.validFrom, anchor.expiresAt, observedAt);
      });
    });

    if (candidates.length === 0) {
      throw new FederationProtocolError("AUTHENTICATION_FAILURE", `No active trusted issuer/anchor for ${issuer}#${anchorId}`, "peer");
    }
    if (candidates.length > 1) {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Ambiguous active trust bundle resolution for ${issuer}#${anchorId}`);
    }

    const bundle = candidates[0];
    const anchor = bundle.anchors.find((candidate) => candidate.id === anchorId)!;
    return { bundle: cloneBundle(bundle), anchor: { ...anchor } };
  }

  list(): FederationTrustBundle[] {
    return [...this.bundles.values()]
      .sort((a, b) => keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0)
      .map(cloneBundle);
  }

  private getMutable(ref: FederationTrustBundleRef): FederationTrustBundle {
    const bundle = this.bundles.get(keyOf(ref));
    if (!bundle) throw new FederationProtocolError("AUTHENTICATION_FAILURE", `Unknown trust bundle: ${ref.id}@${ref.version}`, "peer");
    return bundle;
  }
}

function cloneBundle(bundle: FederationTrustBundle): FederationTrustBundle {
  return {
    ...bundle,
    anchors: bundle.anchors.map((anchor) => ({ ...anchor })),
  };
}
