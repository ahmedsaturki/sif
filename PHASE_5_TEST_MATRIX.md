# SIF Phase 5 — Evaluation & Observability Test Matrix

Required executable acceptance rows: **F5-001..F5-060**.

## Matrix groups

- **F5-001..F5-010 — Trace/evidence identity:** normalized trace context, parent/child correlation, event/policy/federation linkage, bounded metadata, identity collision rejection.
- **F5-011..F5-020 — Observation adapter:** structured span/metric/log boundaries, deterministic attributes, backend isolation, unavailable sink behavior, bounded payloads.
- **F5-021..F5-030 — Evaluation records:** deterministic suite/case identity, normalized inputs, expected/measured outcomes, evidence references, candidate binding, immutable record semantics.
- **F5-031..F5-040 — Replay:** exact input descriptor, candidate/environment binding, historical policy/state references, deterministic rerun, mismatch rejection, replay resource bounds.
- **F5-041..F5-050 — Fault injection:** explicit fault declaration, actual-fault observation proof, no-fault classification, evaluation-failed classification, unavailable evaluator distinction, bounded fault execution.
- **F5-051..F5-060 — Regression/promotion evidence:** cross-phase kernel/persistence/federation/policy invariants, artifact identity binding, evidence completeness, fail-closed promotion gate, reproducible evidence package.

## Pass condition

All rows must be executable and pass against the exact candidate checkout. A row cannot be marked verified merely because a code path exists; the test must demonstrate the claimed property.

## Evidence boundary

Successful Phase 5 CI proves the exact candidate only. It does not imply a production OpenTelemetry deployment or production observability SLA.
