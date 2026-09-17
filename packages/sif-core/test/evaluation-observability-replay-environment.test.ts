import test from "node:test";
import assert from "node:assert/strict";
import { EvaluationObservabilityError, type EvaluationCase, type EvaluationRecord, makeReplayDescriptor, normalizeTraceContext, verifyReplayDescriptor, createEvaluationRecord, type EvaluationObservabilityLimits, type TraceContext } from "../src/index.js";

const L: EvaluationObservabilityLimits = { maxTraceBaggageEntries: 4, maxTraceBaggageBytes: 1000, maxObservationBytes: 4000, maxObservationAttributes: 4, maxEvaluationInputBytes: 1000, maxEvaluationRecordBytes: 5000, maxEvaluationRecords: 10, maxConcurrentEvaluations: 2, maxFaultActions: 4 };
const T: TraceContext = { traceId: "t", spanId: "s", correlationId: "c", baggage: { a: "b" } };
const baseCase: EvaluationCase = { suiteId: "replay", caseId: "environment", candidateCommit: "candidate", environmentFingerprint: "env-a", input: { x: 1 }, expected: true };
const trace = normalizeTraceContext(T, L);
const record: EvaluationRecord = createEvaluationRecord({ evaluationCase: baseCase, measured: true, status: "PASS", trace }, L);

test("phase5 targeted: replay rejects environment mismatch", () => {
  const descriptor = makeReplayDescriptor(record, "artifact-a");
  const mismatchedEnvironment = { ...baseCase, environmentFingerprint: "env-b" };
  let error: unknown;
  try {
    verifyReplayDescriptor(descriptor, mismatchedEnvironment, "artifact-a");
  } catch (candidateError: unknown) {
    error = candidateError;
  }
  assert.equal(error instanceof EvaluationObservabilityError, true);
  assert.equal((error as EvaluationObservabilityError).code, "CANDIDATE_MISMATCH");
});
