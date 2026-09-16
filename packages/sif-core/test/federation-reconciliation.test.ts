import test from "node:test";
import assert from "node:assert/strict";
import {
  FederationProtocolError,
  InMemoryFederationReconciler,
  type FederatedObservation,
} from "../src/index.js";

function observation(overrides: Partial<FederatedObservation> = {}): FederatedObservation {
  return {
    sourceDomain: "remote-a",
    observationId: "obs-001",
    cursor: "0001",
    eventId: "event-001",
    eventDigest: "digest-001",
    occurredAt: "2026-09-16T06:00:00.000Z",
    observedAt: "2026-09-16T06:00:01.000Z",
    payload: { value: 1 },
    ...overrides,
  };
}

test("same evidence received twice is deterministic and idempotent", () => {
  const reconciler = new InMemoryFederationReconciler(10);
  const first = reconciler.reconcile({ observations: [observation()] });
  const second = reconciler.reconcile({ observations: [observation()] });
  assert.equal(first.accepted.length, 1);
  assert.equal(first.duplicates.length, 0);
  assert.equal(second.accepted.length, 0);
  assert.equal(second.duplicates.length, 1);
  assert.equal(reconciler.listObservations().length, 1);
});

test("reordered observations are normalized deterministically without timestamp-based authority", () => {
  const reconciler = new InMemoryFederationReconciler(10);
  const a = observation({ observationId: "obs-002", cursor: "0002", eventId: "event-002", eventDigest: "digest-002", occurredAt: "2026-09-15T01:00:00.000Z" });
  const b = observation({ observationId: "obs-001", cursor: "0001", eventId: "event-001", eventDigest: "digest-001", occurredAt: "2026-09-17T01:00:00.000Z" });
  const result = reconciler.reconcile({ observations: [a, b] });
  assert.deepEqual(result.accepted.map((item) => item.observationId), ["obs-001", "obs-002"]);
  assert.equal(result.nextCursor, "0002");
});

test("conflicting remote observations become explicit conflicts rather than overwrites", () => {
  const reconciler = new InMemoryFederationReconciler(10);
  reconciler.reconcile({ observations: [observation()] });
  const result = reconciler.reconcile({ observations: [observation({ eventDigest: "tampered-digest" })] });
  assert.equal(result.accepted.length, 0);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0]?.reason, "REMOTE_OBSERVATION_DIVERGENCE");
  assert.equal(reconciler.listObservations()[0]?.eventDigest, "digest-001");
});

test("remote state divergence from immutable local history is recorded without mutation", () => {
  const reconciler = new InMemoryFederationReconciler(10);
  const result = reconciler.reconcile({
    observations: [observation()],
    localEventDigests: new Map([["event-001", "local-digest"]]),
  });
  assert.equal(result.accepted.length, 0);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0]?.reason, "LOCAL_EVENT_DIVERGENCE");
  assert.equal(reconciler.listObservations().length, 0);
});

test("same event with the same digest can be represented by distinct observation identities", () => {
  const reconciler = new InMemoryFederationReconciler(10);
  const first = reconciler.reconcile({ observations: [observation()] });
  const second = reconciler.reconcile({ observations: [observation({ observationId: "obs-002", cursor: "0002" })] });
  assert.equal(first.accepted.length, 1);
  assert.equal(second.accepted.length, 1);
  assert.equal(reconciler.listObservations().length, 2);
});

test("oversized reconciliation batch fails before processing", () => {
  const reconciler = new InMemoryFederationReconciler(1);
  assert.throws(
    () => reconciler.reconcile({ observations: [observation(), observation({ observationId: "obs-002", cursor: "0002", eventId: "event-002", eventDigest: "digest-002" })] }),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED",
  );
  assert.equal(reconciler.listObservations().length, 0);
});

test("invalid observations fail closed", () => {
  const reconciler = new InMemoryFederationReconciler(10);
  assert.throws(
    () => reconciler.reconcile({ observations: [observation({ eventId: undefined, evidenceId: undefined })] }),
    TypeError,
  );
});

test("concurrent reconciliation of the same observation does not create duplicate accepted evidence", async () => {
  const reconciler = new InMemoryFederationReconciler(10);
  const results = await Promise.all(
    Array.from({ length: 16 }, () =>
      Promise.resolve().then(() => reconciler.reconcile({ observations: [observation()] })),
    ),
  );

  assert.equal(results.filter((result) => result.accepted.length === 1).length, 1);
  assert.equal(results.filter((result) => result.duplicates.length === 1).length, 15);
  assert.equal(reconciler.listObservations().length, 1);
});

test("concurrent divergent reconciliation stays explicit and preserves the first observation", async () => {
  const reconciler = new InMemoryFederationReconciler(10);
  await reconciler.reconcile({ observations: [observation()] });

  const results = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      Promise.resolve().then(() =>
        reconciler.reconcile({
          observations: [observation({ eventDigest: `tampered-${index}` })],
        }),
      ),
    ),
  );

  assert.equal(results.every((result) => result.accepted.length === 0), true);
  assert.equal(results.every((result) => result.conflicts.length === 1), true);
  assert.equal(reconciler.listObservations().length, 1);
  assert.equal(reconciler.listObservations()[0]?.eventDigest, "digest-001");
});
