import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryObservationSink, RegressionSuiteRunner, normalizeTraceContext, type EvaluationObservabilityLimits, type TraceContext } from "../src/index.js";

const limits: EvaluationObservabilityLimits = { maxTraceBaggageEntries: 4, maxTraceBaggageBytes: 1000, maxObservationBytes: 4000, maxObservationAttributes: 4, maxEvaluationInputBytes: 1000, maxEvaluationRecordBytes: 5000, maxEvaluationRecords: 10, maxConcurrentEvaluations: 2, maxFaultActions: 4 };
const trace: TraceContext = { traceId: "t", spanId: "s", correlationId: "c" };

 test("F5-regression-semantics-mismatch", async () => {
  const sink = new InMemoryObservationSink();
  const result = await new RegressionSuiteRunner(sink, limits).run(
    "suite",
    "candidate",
    [{ id: "mismatch", expected: true, run: async () => false }],
    normalizeTraceContext(trace, limits),
    "env",
  );
  assert.equal(result.completed, 1);
  assert.equal(result.passed, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.results[0]!.status, "FAIL");
  assert.equal(result.results[0]!.failure, "Measured result does not match expected result");
  assert.notEqual(result.results[0]!.expectedDigest, result.results[0]!.measuredDigest);
  assert.equal(sink.all().length, 1);
});
