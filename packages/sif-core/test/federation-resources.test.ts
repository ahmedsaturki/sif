import test from "node:test";
import assert from "node:assert/strict";
import { FederationProtocolError, FederationResourceGovernor, type FederationResourceLimits } from "../src/index.js";

const limits: FederationResourceLimits = {
  maxConcurrentSessions: 2,
  maxOutstandingInboxWork: 2,
  maxReplayEntries: 2,
  maxReconciliationBatch: 2,
  maxPeerRatePerWindow: 2,
  maxGlobalRatePerWindow: 3,
  rateWindowMs: 1000,
};

test("concurrent sessions are bounded and released", () => {
  const governor = new FederationResourceGovernor(limits);
  governor.openSession("peer-a", 1000);
  governor.openSession("peer-b", 1000);
  assert.throws(() => governor.openSession("peer-c", 1000), (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED");
  governor.closeSession();
  governor.openSession("peer-c", 1000);
  assert.equal(governor.snapshot().concurrentSessions, 2);
});

test("peer and global session rates are bounded per window", () => {
  const governor = new FederationResourceGovernor(limits);
  governor.openSession("peer-a", 1000);
  governor.closeSession();
  governor.openSession("peer-a", 1000);
  governor.closeSession();
  assert.throws(() => governor.openSession("peer-a", 1000), (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED");

  const globalGovernor = new FederationResourceGovernor(limits);
  globalGovernor.openSession("a", 2000); globalGovernor.closeSession();
  globalGovernor.openSession("b", 2000); globalGovernor.closeSession();
  globalGovernor.openSession("c", 2000); globalGovernor.closeSession();
  assert.throws(() => globalGovernor.openSession("d", 2000), (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED");
  globalGovernor.openSession("d", 3000);
  assert.equal(globalGovernor.snapshot().globalWindowStarts, 1);
});

test("rate windows reset deterministically", () => {
  const governor = new FederationResourceGovernor(limits);
  governor.openSession("peer-a", 1000);
  governor.closeSession();
  governor.openSession("peer-a", 2000);
  assert.equal(governor.snapshot().peerWindowStarts, 1);
});

test("inbox work and replay retention are bounded", () => {
  const governor = new FederationResourceGovernor(limits);
  governor.beginInboxWork();
  governor.beginInboxWork();
  assert.throws(() => governor.beginInboxWork(), (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED");
  governor.endInboxWork();
  governor.beginInboxWork();

  governor.retainReplayEntry();
  governor.retainReplayEntry();
  assert.throws(() => governor.retainReplayEntry(), (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED");
  governor.releaseReplayEntry();
  governor.retainReplayEntry();
  assert.equal(governor.snapshot().replayEntries, 2);
});

test("reconciliation batch limit fails closed", () => {
  const governor = new FederationResourceGovernor(limits);
  governor.assertReconciliationBatch(2);
  assert.throws(() => governor.assertReconciliationBatch(3), (error: unknown) => error instanceof FederationProtocolError && error.code === "RESOURCE_EXHAUSTED");
});
