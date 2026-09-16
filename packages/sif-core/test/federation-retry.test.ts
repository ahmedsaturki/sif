import test from "node:test";
import assert from "node:assert/strict";
import { FederationProtocolError, FederationRetryController, classifyFederationRetry } from "../src/index.js";

test("retry classifier keeps unknown outcome separate from transient retry", () => {
  assert.equal(classifyFederationRetry("TRANSIENT_DELIVERY_FAILURE"), "RETRY");
  assert.equal(classifyFederationRetry("PEER_UNAVAILABLE"), "RETRY");
  assert.equal(classifyFederationRetry("UNKNOWN_OUTCOME"), "RECONCILE");
  assert.equal(classifyFederationRetry("AUTHORIZATION_DENIED"), "STOP");
});

test("transient failures use bounded exponential backoff and retain idempotency key", () => {
  const controller = new FederationRetryController({ maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 250 });
  const initial = controller.begin("msg-1");
  assert.equal(initial.attempts, 0);
  const first = controller.record("msg-1", "TRANSIENT_DELIVERY_FAILURE", "2026-09-16T08:00:00.000Z", "timeout");
  assert.equal(first.attempts, 1);
  assert.equal(first.decision, "RETRY");
  assert.equal(first.nextAttemptAt, "2026-09-16T08:00:00.100Z");
  assert.equal(first.history[0]?.idempotencyKey, "msg-1");
  const second = controller.record("msg-1", "PEER_UNAVAILABLE", "2026-09-16T08:00:01.000Z");
  assert.equal(second.nextAttemptAt, "2026-09-16T08:00:01.200Z");
  assert.equal(controller.canRetry("msg-1", "2026-09-16T08:00:01.199Z"), false);
  assert.equal(controller.canRetry("msg-1", "2026-09-16T08:00:01.200Z"), true);
});

test("terminal outcomes stop automatic retry", () => {
  const controller = new FederationRetryController({ maxAttempts: 5, baseDelayMs: 10, maxDelayMs: 100 });
  const denied = controller.record("denied", "AUTHORIZATION_DENIED", "2026-09-16T08:00:00.000Z");
  assert.equal(denied.decision, "STOP");
  assert.equal(denied.nextAttemptAt, undefined);
  assert.equal(controller.canRetry("denied", "2026-09-16T08:10:00.000Z"), false);
});

test("unknown outcome always transitions to reconciliation instead of success or retry", () => {
  const controller = new FederationRetryController({ maxAttempts: 5, baseDelayMs: 10, maxDelayMs: 100 });
  const state = controller.record("ambiguous", "UNKNOWN_OUTCOME", "2026-09-16T08:00:00.000Z");
  assert.equal(state.decision, "RECONCILE");
  assert.equal(state.attempts, 1);
  assert.equal(state.nextAttemptAt, undefined);
  assert.equal(controller.canRetry("ambiguous", "2026-09-16T09:00:00.000Z"), false);
});

test("retry budget is bounded by maxAttempts", () => {
  const controller = new FederationRetryController({ maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 10 });
  const first = controller.record("budget", "TRANSIENT_DELIVERY_FAILURE", "2026-09-16T08:00:00.000Z");
  assert.equal(first.decision, "RETRY");
  const second = controller.record("budget", "TRANSIENT_DELIVERY_FAILURE", "2026-09-16T08:00:00.001Z");
  assert.equal(second.decision, "STOP");
  assert.equal(second.attempts, 2);
  assert.equal(controller.canRetry("budget", "2026-09-16T08:00:10.000Z"), false);
});

test("terminal retry state cannot be mutated after completion", () => {
  const controller = new FederationRetryController({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
  controller.record("terminal", "DELIVERED", "2026-09-16T08:00:00.000Z");
  assert.throws(
    () => controller.record("terminal", "TRANSIENT_DELIVERY_FAILURE", "2026-09-16T08:00:00.001Z"),
    (error: unknown) => error instanceof FederationProtocolError && error.code === "INTEGRITY_FAILURE",
  );
});

test("invalid retry policy is rejected", () => {
  assert.throws(() => new FederationRetryController({ maxAttempts: 0, baseDelayMs: 1, maxDelayMs: 2 }), TypeError);
  assert.throws(() => new FederationRetryController({ maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 1 }), TypeError);
});
