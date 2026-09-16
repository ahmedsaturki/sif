import test from "node:test";
import assert from "node:assert/strict";
import { FederationProtocolError } from "../src/federation-envelope.js";
import { FederationTrustBoundary, type FederationTrustAnchor, type TrustedFederationPeer } from "../src/federation-trust.js";

const anchor: FederationTrustAnchor = {
  id: "anchor-a",
  subject: "trust-root-a",
  status: "active",
  validFrom: "2026-09-16T00:00:00.000Z",
  expiresAt: "2026-09-17T00:00:00.000Z",
};

function peer(overrides: Partial<TrustedFederationPeer> = {}): TrustedFederationPeer {
  return {
    identity: {
      domain: "remote-a",
      subject: "workload-a",
      transportBinding: "transport://remote-a/workload-a",
    },
    trustAnchorId: anchor.id,
    status: "active",
    allowedTargetDomains: ["local-a"],
    ...overrides,
  };
}

function boundary(): FederationTrustBoundary {
  const b = new FederationTrustBoundary("local-a");
  b.registerTrustAnchor(anchor);
  return b;
}

test("a trusted peer authenticates only through its bound trust anchor", () => {
  const b = boundary();
  b.registerPeer(peer());
  const decision = b.authenticate({ identity: peer().identity, trustAnchorId: anchor.id }, "2026-09-16T01:00:00.000Z");
  assert.equal(decision.authenticated, true);
  assert.equal(decision.authorizedForLocalDomain, true);
});

test("unknown peer fails closed", () => {
  const b = boundary();
  assert.throws(() => b.authenticate({ identity: peer().identity, trustAnchorId: anchor.id }, "2026-09-16T01:00:00.000Z"), FederationProtocolError);
});

test("mismatched trust-anchor binding fails closed", () => {
  const b = boundary();
  b.registerPeer(peer());
  assert.throws(() => b.authenticate({ identity: peer().identity, trustAnchorId: "other-anchor" }, "2026-09-16T01:00:00.000Z"), FederationProtocolError);
});

test("revoked peer fails closed", () => {
  const b = boundary();
  b.registerPeer(peer());
  b.revokePeer(peer().identity);
  assert.throws(() => b.authenticate({ identity: peer().identity, trustAnchorId: anchor.id }, "2026-09-16T01:00:00.000Z"), FederationProtocolError);
});

test("revoked or expired trust anchor fails closed", () => {
  const b = boundary();
  const p = peer();
  b.registerPeer(p);
  b.revokeTrustAnchor(anchor.id);
  assert.throws(() => b.authenticate({ identity: p.identity, trustAnchorId: anchor.id }, "2026-09-16T01:00:00.000Z"), FederationProtocolError);

  const b2 = boundary();
  b2.registerPeer(p);
  assert.throws(() => b2.authenticate({ identity: p.identity, trustAnchorId: anchor.id }, "2026-09-17T00:00:00.000Z"), FederationProtocolError);
});

test("remote identity cannot claim the local domain", () => {
  const b = boundary();
  assert.throws(() => b.registerPeer(peer({ identity: { ...peer().identity, domain: "local-a" } })), FederationProtocolError);
});

test("peer requires explicit local target authorization", () => {
  const b = boundary();
  assert.throws(() => b.registerPeer(peer({ allowedTargetDomains: ["other-local"] })), FederationProtocolError);
});

test("trust registration is immutable by duplicate identity/anchor insertion", () => {
  const b = boundary();
  assert.throws(() => b.registerTrustAnchor(anchor), FederationProtocolError);
  b.registerPeer(peer());
  assert.throws(() => b.registerPeer(peer()), FederationProtocolError);
});
