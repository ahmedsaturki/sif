import test from "node:test";
import assert from "node:assert/strict";
import {
  FederationProtocolError,
  FederationTrustBundleRegistry,
  type FederationTrustBundleAnchor,
  type FederationTrustBundleInput,
} from "../src/index.js";

const BASE_ANCHOR: FederationTrustBundleAnchor = {
  id: "root-a",
  subject: "CN=SIF Root A",
  validFrom: "2026-09-16T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
};

const BASE: FederationTrustBundleInput = {
  id: "issuer-bundle",
  version: "2026-09-16.1",
  issuer: "spiffe://sif.example/issuer",
  provenanceId: "evidence:trust-bundle:2026-09-16.1",
  validFrom: "2026-09-16T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
  anchors: [BASE_ANCHOR],
};

function federationError(code: FederationProtocolError["code"]): (error: unknown) => boolean {
  return (error: unknown): error is FederationProtocolError => error instanceof FederationProtocolError && error.code === code;
}

test("trust bundle is registered inactive and activates explicitly", () => {
  const registry = new FederationTrustBundleRegistry();
  const ref = registry.register(BASE);

  assert.equal(registry.get(ref).status, "registered");
  assert.throws(
    () => registry.resolve(BASE.issuer, "root-a", "2026-09-16T01:00:00.000Z"),
    federationError("AUTHENTICATION_FAILURE"),
  );

  registry.activate(ref, "2026-09-16T01:00:00.000Z");
  const resolved = registry.resolve(BASE.issuer, "root-a", "2026-09-16T02:00:00.000Z");
  assert.equal(resolved.bundle.version, BASE.version);
  assert.equal(resolved.anchor.id, "root-a");
});

test("unknown issuer or anchor fails closed", () => {
  const registry = new FederationTrustBundleRegistry();
  const ref = registry.register(BASE);
  registry.activate(ref, "2026-09-16T01:00:00.000Z");

  assert.throws(
    () => registry.resolve("spiffe://unknown", "root-a", "2026-09-16T02:00:00.000Z"),
    federationError("AUTHENTICATION_FAILURE"),
  );
  assert.throws(
    () => registry.resolve(BASE.issuer, "unknown-root", "2026-09-16T02:00:00.000Z"),
    federationError("AUTHENTICATION_FAILURE"),
  );
});

test("bundle versions are immutable and duplicate registration fails closed", () => {
  const registry = new FederationTrustBundleRegistry();
  const ref = registry.register(BASE);
  const snapshot = registry.get(ref);
  assert.ok(snapshot.anchors[0]);
  snapshot.anchors[0].subject = "mutated";

  const stored = registry.get(ref);
  assert.ok(stored.anchors[0]);
  assert.equal(stored.anchors[0].subject, "CN=SIF Root A");
  assert.throws(() => registry.register(BASE), federationError("INTEGRITY_FAILURE"));
});

test("activation rejects validity violations and overlapping active issuer trust", () => {
  const registry = new FederationTrustBundleRegistry();
  const first = registry.register(BASE);
  registry.activate(first, "2026-09-16T01:00:00.000Z");

  const second = registry.register({
    ...BASE,
    version: "2026-09-16.2",
    provenanceId: "evidence:trust-bundle:2026-09-16.2",
    anchors: [BASE_ANCHOR],
  });
  assert.throws(
    () => registry.activate(second, "2026-09-16T02:00:00.000Z"),
    federationError("INTEGRITY_FAILURE"),
  );

  const futureAnchor: FederationTrustBundleAnchor = {
    ...BASE_ANCHOR,
    validFrom: "2026-09-17T00:00:00.000Z",
  };
  const future = registry.register({
    ...BASE,
    version: "2026-09-16.3",
    provenanceId: "evidence:trust-bundle:2026-09-16.3",
    validFrom: "2026-09-17T00:00:00.000Z",
    anchors: [futureAnchor],
  });
  assert.throws(
    () => registry.activate(future, "2026-09-16T23:00:00.000Z"),
    federationError("AUTHENTICATION_FAILURE"),
  );
});

test("retirement is explicit and removes trust at the retirement time", () => {
  const registry = new FederationTrustBundleRegistry();
  const ref = registry.register(BASE);
  registry.activate(ref, "2026-09-16T01:00:00.000Z");
  registry.retire(ref, "2026-09-16T12:00:00.000Z");

  const retired = registry.get(ref);
  assert.equal(retired.status, "retired");
  assert.equal(retired.retiredAt, "2026-09-16T12:00:00.000Z");

  const historical = registry.resolve(BASE.issuer, "root-a", "2026-09-16T11:59:59.999Z");
  assert.equal(historical.bundle.status, "retired");
  assert.throws(
    () => registry.resolve(BASE.issuer, "root-a", "2026-09-16T12:00:00.000Z"),
    federationError("AUTHENTICATION_FAILURE"),
  );
  assert.throws(
    () => registry.activate(ref, "2026-09-16T13:00:00.000Z"),
    federationError("INTEGRITY_FAILURE"),
  );
});

test("resolution respects bundle and anchor effective-time windows", () => {
  const registry = new FederationTrustBundleRegistry();
  const ref = registry.register({
    ...BASE,
    anchors: [{
      ...BASE_ANCHOR,
      validFrom: "2026-09-16T06:00:00.000Z",
      expiresAt: "2026-09-16T10:00:00.000Z",
    }],
  });
  registry.activate(ref, "2026-09-16T06:00:00.000Z");

  assert.throws(
    () => registry.resolve(BASE.issuer, "root-a", "2026-09-16T05:59:59.999Z"),
    federationError("AUTHENTICATION_FAILURE"),
  );
  assert.equal(registry.resolve(BASE.issuer, "root-a", "2026-09-16T09:59:59.999Z").anchor.id, "root-a");
  assert.throws(
    () => registry.resolve(BASE.issuer, "root-a", "2026-09-16T10:00:00.000Z"),
    federationError("AUTHENTICATION_FAILURE"),
  );
});

test("list is deterministic and exposes provenance plus lifecycle evidence", () => {
  const registry = new FederationTrustBundleRegistry();
  const z = registry.register({ ...BASE, id: "z", version: "2", provenanceId: "p-z", anchors: [BASE_ANCHOR] });
  const a = registry.register({ ...BASE, id: "a", version: "1", provenanceId: "p-a", anchors: [BASE_ANCHOR] });
  registry.activate(a, "2026-09-16T01:00:00.000Z");
  registry.retire(z, "2026-09-16T01:00:00.000Z");

  const listed = registry.list();
  assert.deepEqual(listed.map((bundle) => `${bundle.id}@${bundle.version}`), ["a@1", "z@2"]);
  assert.ok(listed[0]);
  assert.equal(listed[0].provenanceId, "p-a");
  assert.equal(listed[0].activatedAt, "2026-09-16T01:00:00.000Z");
  assert.ok(listed[1]);
  assert.equal(listed[1].status, "retired");
});
