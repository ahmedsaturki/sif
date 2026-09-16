# SIF Phase 5 — Evaluation & Observability Test Matrix

Required executable acceptance rows: **F5-001..F5-060**.

## Matrix groups

- **F5-001..F5-010 — Trace/evidence identity:** normalized trace context, parent/child correlation, bounded baggage, deterministic context identity, and caller-immutability.
- **F5-011..F5-020 — Observation adapter:** structured span/metric/log boundaries, deterministic observation identity, immutable sink reads, bounded attributes/payloads, and backend isolation.
- **F5-021..F5-030 — Evaluation records:** deterministic suite/case identity, normalized input identity, expected/measured digests, candidate binding, failure capture, and input/resource bounds.
- **F5-031..F5-040 — Replay:** exact candidate/artifact/environment/case binding, deterministic replay descriptor identity, mismatch rejection, and non-replayable input rejection.
- **F5-041..F5-045 — Regression execution:** true bounded parallelism, pass/fail capture, observation emission, candidate propagation, and bounded case counts.
- **F5-046..F5-050 — Fault injection:** explicit fault declaration, actual-fault observation proof, no-fault classification, evaluation-failed classification, unavailable evaluator distinction, and finite action budget.
- **F5-051..F5-060 — Regression/promotion evidence:** observability backend no-op behavior, fail-closed candidate/artifact evidence, indeterminate/unavailable rejection, non-required fault handling, evidence linkage, and reproducible final promotion evidence.

## Pass condition

All rows must be executable and pass against the exact candidate checkout. A row cannot be marked verified merely because a code path exists; the test must demonstrate the claimed property.

## Evidence boundary

Successful Phase 5 CI proves the exact candidate only. It does not imply a production OpenTelemetry deployment or production observability SLA.
