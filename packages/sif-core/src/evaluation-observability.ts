import { digest, stableStringify } from "./core.js";

export type ObservationKind = "TRACE" | "METRIC" | "LOG";
export type EvaluationStatus = "PASS" | "FAIL" | "INDETERMINATE" | "UNAVAILABLE";
export type FaultObservationStatus = "OBSERVED" | "NOT_OBSERVED" | "EVALUATION_FAILED" | "UNAVAILABLE";

export interface EvaluationObservabilityLimits {
  maxTraceBaggageEntries: number;
  maxTraceBaggageBytes: number;
  maxObservationBytes: number;
  maxObservationAttributes: number;
  maxEvaluationInputBytes: number;
  maxEvaluationRecordBytes: number;
  maxEvaluationRecords: number;
  maxConcurrentEvaluations: number;
  maxFaultActions: number;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  correlationId: string;
  baggage?: Record<string, string>;
}

export interface NormalizedTraceContext extends TraceContext {
  contextDigest: string;
  baggageBytes: number;
}

export interface ObservationRecord {
  observationId: string;
  kind: ObservationKind;
  name: string;
  occurredAt: string;
  trace: NormalizedTraceContext;
  attributes: Record<string, string | number | boolean | null>;
  evidenceRefs?: string[];
}

export interface ObservationSink {
  emit(record: ObservationRecord): Promise<void>;
}

export class InMemoryObservationSink implements ObservationSink {
  private readonly records: ObservationRecord[] = [];
  constructor(private readonly maxRecords = 10_000) {}
  async emit(record: ObservationRecord): Promise<void> {
    if (this.records.length >= this.maxRecords) throw new Error("Observation sink capacity exhausted");
    this.records.push(structuredClone(record));
  }
  all(): ObservationRecord[] { return this.records.map((record) => structuredClone(record)); }
}

export class NoopObservationSink implements ObservationSink {
  async emit(_record: ObservationRecord): Promise<void> {}
}

export interface EvaluationCase {
  suiteId: string;
  caseId: string;
  candidateCommit: string;
  environmentFingerprint: string;
  input: unknown;
  expected: unknown;
}

export interface EvaluationRecord {
  evaluationId: string;
  suiteId: string;
  caseId: string;
  candidateCommit: string;
  environmentFingerprint: string;
  inputDigest: string;
  expectedDigest: string;
  measuredDigest: string;
  status: EvaluationStatus;
  trace: NormalizedTraceContext;
  evidenceRefs: string[];
  failure?: string;
}

export interface ReplayDescriptor {
  candidateCommit: string;
  artifactDigest: string;
  environmentFingerprint: string;
  suiteId: string;
  caseId: string;
  inputDigest: string;
  expectedDigest: string;
}

export interface FaultRequest {
  faultId: string;
  boundary: string;
  action: string;
}

export interface FaultObservation {
  faultId: string;
  requested: boolean;
  observed: boolean;
  status: FaultObservationStatus;
  evidenceRef?: string;
  reason?: string;
}

export interface FaultExecutionResult {
  observed: boolean;
  status?: "NOT_OBSERVED" | "UNAVAILABLE";
  evidenceRef?: string;
  reason?: string;
}

export interface FaultExecutor {
  execute(request: FaultRequest): Promise<FaultExecutionResult>;
}

export interface FaultInjector {
  inject(request: FaultRequest): Promise<FaultObservation>;
}

export class BoundedFaultInjector implements FaultInjector {
  private usedActions = 0;
  constructor(private readonly executor: FaultExecutor, private readonly limits: EvaluationObservabilityLimits) {
    positive("maxFaultActions", limits.maxFaultActions);
  }
  async inject(request: FaultRequest): Promise<FaultObservation> {
    text("faultId", request.faultId);
    text("boundary", request.boundary);
    text("action", request.action);
    if (this.usedActions >= this.limits.maxFaultActions) {
      throw new EvaluationObservabilityError("RESOURCE_EXHAUSTED", "Fault action limit exceeded");
    }
    this.usedActions += 1;
    try {
      const result = await this.executor.execute(clone(request));
      if (result.observed) {
        if (result.evidenceRef === undefined || result.evidenceRef.length === 0) {
          return {
            faultId: request.faultId,
            requested: true,
            observed: false,
            status: "EVALUATION_FAILED",
            reason: "Fault executor reported observed=true without explicit evidence proof",
          };
        }
        return {
          faultId: request.faultId,
          requested: true,
          observed: true,
          status: "OBSERVED",
          evidenceRef: result.evidenceRef,
          ...(result.reason === undefined ? {} : { reason: result.reason }),
        };
      }
      const status = result.status ?? "NOT_OBSERVED";
      return {
        faultId: request.faultId,
        requested: true,
        observed: false,
        status,
        ...(result.reason === undefined ? {} : { reason: result.reason }),
      };
    } catch (error) {
      return {
        faultId: request.faultId,
        requested: true,
        observed: false,
        status: "EVALUATION_FAILED",
        reason: String(error),
      };
    }
  }
}

export interface RegressionCase {
  id: string;
  run: () => Promise<unknown>;
  expected?: unknown;
}

export interface RegressionResult {
  suiteId: string;
  candidateCommit: string;
  completed: number;
  passed: number;
  failed: number;
  indeterminate: number;
  results: EvaluationRecord[];
}

export interface PromotionEvidenceInput {
  candidateCommit: string;
  artifactDigest: string;
  evaluations: EvaluationRecord[];
  faults: FaultObservation[];
}

export class EvaluationObservabilityError extends Error {
  constructor(readonly code:
    | "INVALID_TRACE"
    | "RESOURCE_EXHAUSTED"
    | "INVALID_OBSERVATION"
    | "EVALUATION_NOT_REPLAYABLE"
    | "CANDIDATE_MISMATCH"
    | "EVIDENCE_INCOMPLETE"
    | "FAULT_NOT_PROVEN"
  , message: string) {
    super(message);
    this.name = "EvaluationObservabilityError";
  }
}

function text(name: string, value: string): void {
  if (value.length === 0) throw new EvaluationObservabilityError("INVALID_TRACE", `${name} must not be empty`);
}
function iso(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new EvaluationObservabilityError("INVALID_TRACE", `${name} must be valid ISO time`);
}
function positive(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new EvaluationObservabilityError("RESOURCE_EXHAUSTED", `${name} must be positive`);
}
function jsonBytes(value: unknown): number { return new TextEncoder().encode(stableStringify(value)).byteLength; }
function clone<T>(value: T): T { return structuredClone(value); }

export function normalizeTraceContext(context: TraceContext, limits: EvaluationObservabilityLimits): NormalizedTraceContext {
  text("traceId", context.traceId);
  text("spanId", context.spanId);
  text("correlationId", context.correlationId);
  if (context.parentSpanId !== undefined) text("parentSpanId", context.parentSpanId);
  if (context.baggage !== undefined) {
    const keys = Object.keys(context.baggage);
    if (keys.length > limits.maxTraceBaggageEntries) throw new EvaluationObservabilityError("RESOURCE_EXHAUSTED", "Trace baggage entry limit exceeded");
    for (const key of keys) {
      text("baggage key", key);
      text("baggage value", context.baggage[key]!);
    }
  }
  const normalized: TraceContext = {
    traceId: context.traceId,
    spanId: context.spanId,
    ...(context.parentSpanId === undefined ? {} : { parentSpanId: context.parentSpanId }),
    correlationId: context.correlationId,
    ...(context.baggage === undefined ? {} : { baggage: clone(context.baggage) }),
  };
  const baggageBytes = context.baggage === undefined ? 0 : jsonBytes(context.baggage);
  if (baggageBytes > limits.maxTraceBaggageBytes) throw new EvaluationObservabilityError("RESOURCE_EXHAUSTED", "Trace baggage byte limit exceeded");
  return { ...normalized, contextDigest: digest(normalized), baggageBytes };
}

export function createObservation(args: {
  kind: ObservationKind;
  name: string;
  occurredAt: string;
  trace: NormalizedTraceContext;
  attributes?: Record<string, string | number | boolean | null>;
  evidenceRefs?: string[];
}, limits: EvaluationObservabilityLimits): ObservationRecord {
  text("name", args.name);
  iso("occurredAt", args.occurredAt);
  const attributes = args.attributes === undefined ? {} : clone(args.attributes);
  if (Object.keys(attributes).length > limits.maxObservationAttributes) throw new EvaluationObservabilityError("RESOURCE_EXHAUSTED", "Observation attribute limit exceeded");
  const recordWithoutId = {
    kind: args.kind,
    name: args.name,
    occurredAt: new Date(args.occurredAt).toISOString(),
    trace: args.trace,
    attributes,
    ...(args.evidenceRefs === undefined ? {} : { evidenceRefs: [...args.evidenceRefs] }),
  };
  const observationId = digest(recordWithoutId);
  const record: ObservationRecord = { observationId, ...recordWithoutId };
  if (jsonBytes(record) > limits.maxObservationBytes) throw new EvaluationObservabilityError("RESOURCE_EXHAUSTED", "Observation byte limit exceeded");
  return record;
}

export function createEvaluationRecord(args: {
  evaluationCase: EvaluationCase;
  measured: unknown;
  status: EvaluationStatus;
  trace: NormalizedTraceContext;
  evidenceRefs?: string[];
  failure?: string;
}, limits: EvaluationObservabilityLimits): EvaluationRecord {
  text("suiteId", args.evaluationCase.suiteId);
  text("caseId", args.evaluationCase.caseId);
  text("candidateCommit", args.evaluationCase.candidateCommit);
  text("environmentFingerprint", args.evaluationCase.environmentFingerprint);
  const inputDigest = digest(args.evaluationCase.input);
  const expectedDigest = digest(args.evaluationCase.expected);
  const measuredDigest = digest(args.measured);
  const recordBase = {
    suiteId: args.evaluationCase.suiteId,
    caseId: args.evaluationCase.caseId,
    candidateCommit: args.evaluationCase.candidateCommit,
    environmentFingerprint: args.evaluationCase.environmentFingerprint,
    inputDigest,
    expectedDigest,
    measuredDigest,
    status: args.status,
    trace: args.trace,
    evidenceRefs: args.evidenceRefs === undefined ? [] : [...args.evidenceRefs],
    ...(args.failure === undefined ? {} : { failure: args.failure }),
  };
  if (jsonBytes(args.evaluationCase.input) > limits.maxEvaluationInputBytes) throw new EvaluationObservabilityError("RESOURCE_EXHAUSTED", "Evaluation input exceeds byte limit");
  if (jsonBytes(recordBase) > limits.maxEvaluationRecordBytes) throw new EvaluationObservabilityError("RESOURCE_EXHAUSTED", "Evaluation record exceeds byte limit");
  return { evaluationId: digest(recordBase), ...recordBase };
}

export function makeReplayDescriptor(record: EvaluationRecord, artifactDigest: string): ReplayDescriptor {
  text("artifactDigest", artifactDigest);
  return {
    candidateCommit: record.candidateCommit,
    artifactDigest,
    environmentFingerprint: record.environmentFingerprint,
    suiteId: record.suiteId,
    caseId: record.caseId,
    inputDigest: record.inputDigest,
    expectedDigest: record.expectedDigest,
  };
}

export function verifyReplayDescriptor(descriptor: ReplayDescriptor, evaluationCase: EvaluationCase, artifactDigest: string): void {
  if (descriptor.candidateCommit !== evaluationCase.candidateCommit || descriptor.artifactDigest !== artifactDigest || descriptor.suiteId !== evaluationCase.suiteId || descriptor.caseId !== evaluationCase.caseId) {
    throw new EvaluationObservabilityError("CANDIDATE_MISMATCH", "Replay descriptor does not match candidate/case");
  }
  if (descriptor.inputDigest !== digest(evaluationCase.input) || descriptor.expectedDigest !== digest(evaluationCase.expected)) {
    throw new EvaluationObservabilityError("EVALUATION_NOT_REPLAYABLE", "Replay input identity does not match descriptor");
  }
}

export async function emitObservationSafely(sink: ObservationSink, record: ObservationRecord): Promise<void> {
  try {
    await sink.emit(record);
  } catch {
    // Observability failure must not alter business semantics.
  }
}

export class RegressionSuiteRunner {
  constructor(private readonly sink: ObservationSink, private readonly limits: EvaluationObservabilityLimits) {
    positive("maxEvaluationRecords", limits.maxEvaluationRecords);
    positive("maxConcurrentEvaluations", limits.maxConcurrentEvaluations);
    positive("maxEvaluationRecordBytes", limits.maxEvaluationRecordBytes);
  }
  async run(suiteId: string, candidateCommit: string, cases: RegressionCase[], context: NormalizedTraceContext, environmentFingerprint: string): Promise<RegressionResult> {
    text("suiteId", suiteId);
    text("candidateCommit", candidateCommit);
    text("environmentFingerprint", environmentFingerprint);
    if (cases.length > this.limits.maxEvaluationRecords) throw new EvaluationObservabilityError("RESOURCE_EXHAUSTED", "Regression case count exceeds limit");
    const results = new Array<EvaluationRecord>(cases.length);
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextIndex++;
        if (index >= cases.length) return;
        const regressionCase = cases[index]!;
        const hasExpected = regressionCase.expected !== undefined;
        let evaluationCase: EvaluationCase = {
          suiteId,
          caseId: regressionCase.id,
          candidateCommit,
          environmentFingerprint,
          input: { caseId: regressionCase.id },
          expected: regressionCase.expected,
        };
        try {
          const rawMeasured = await regressionCase.run();
          const measured = rawMeasured === undefined ? true : rawMeasured;
          const expected = hasExpected ? regressionCase.expected : measured;
          evaluationCase = { ...evaluationCase, expected };
          const matches = !hasExpected || digest(measured) === digest(expected);
          const status: EvaluationStatus = matches ? "PASS" : "FAIL";
          const failure = matches ? undefined : "Measured result does not match expected result";
          const record = createEvaluationRecord({ evaluationCase, measured, status, trace: context, ...(failure === undefined ? {} : { failure }) }, this.limits);
          results[index] = record;
          await emitObservationSafely(this.sink, createObservation({
            kind: "TRACE",
            name: `evaluation.${regressionCase.id}`,
            occurredAt: new Date().toISOString(),
            trace: context,
            attributes: { status },
            evidenceRefs: [record.evaluationId],
          }, this.limits));
        } catch (error) {
          results[index] = createEvaluationRecord({
            evaluationCase: { ...evaluationCase, expected: evaluationCase.expected ?? String(error) },
            measured: String(error),
            status: "FAIL",
            trace: context,
            failure: String(error),
          }, this.limits);
        }
      }
    };
    const workerCount = Math.min(this.limits.maxConcurrentEvaluations, cases.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    const completed = results.filter((record): record is EvaluationRecord => record !== undefined);
    return {
      suiteId,
      candidateCommit,
      completed: completed.length,
      passed: completed.filter((x) => x.status === "PASS").length,
      failed: completed.filter((x) => x.status === "FAIL").length,
      indeterminate: completed.filter((x) => x.status === "INDETERMINATE" || x.status === "UNAVAILABLE").length,
      results: completed,
    };
  }
}

export function assertPromotionEvidence(input: PromotionEvidenceInput): void {
  text("candidateCommit", input.candidateCommit);
  text("artifactDigest", input.artifactDigest);
  if (input.evaluations.length === 0) throw new EvaluationObservabilityError("EVIDENCE_INCOMPLETE", "No evaluation evidence supplied");
  if (input.evaluations.some((record) => record.candidateCommit !== input.candidateCommit)) throw new EvaluationObservabilityError("CANDIDATE_MISMATCH", "Evaluation evidence references another candidate");
  if (input.evaluations.some((record) => record.status !== "PASS")) throw new EvaluationObservabilityError("EVIDENCE_INCOMPLETE", "Not all promotion evidence passed");
  if (input.faults.some((fault) => fault.requested && (!fault.observed || fault.status !== "OBSERVED" || fault.evidenceRef === undefined || fault.evidenceRef.length === 0))) {
    throw new EvaluationObservabilityError("FAULT_NOT_PROVEN", "A requested fault was not proven observed");
  }
}
