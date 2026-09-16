# SIF Phase 5 — Evaluation & Observability Implementation Contract

## Runtime requirements

- `TraceContext` is explicit, normalized, and bounded.
- Observation emission is adapter-based and must not add mandatory runtime dependencies to the kernel.
- Evaluation records are deterministic from candidate identity, suite/case identity, normalized input, expected outcome and measured outcome.
- Evaluation evidence references exact policy/event/federation identities where applicable.
- Replay requests carry immutable input identity and environment/candidate identity.
- Fault injection declares the intended fault, execution boundary, observation proof and resulting classification; an observed fault requires a non-empty evidence reference.
- Fault execution is bounded by a finite action budget and never reports an observed fault without proof.
- Observability failure is isolated from authorization and event-authority semantics.
- Sensitive peer/domain identifiers are kept within declared scope and never silently repurposed as authorization.
- Regression execution is bounded by case count, record payload size, and true execution concurrency.
- Promotion evidence is fail-closed when candidate identity or artifact identity cannot be established.

## Required interfaces

1. Trace/evidence correlation adapter.
2. Structured observation sink adapter.
3. Evaluation recorder and deterministic result model.
4. Replay descriptor and execution boundary.
5. Bounded fault injector with explicit observed-fault proof and unavailable/evaluation-failed classification.
6. Regression suite coordinator with bounded parallel execution.
7. Candidate/artifact provenance binding.

## Verification

The Phase 5 test matrix must become executable F5-001..F5-060 coverage across deterministic evaluation, trace correlation, observer isolation, replay, fault proof, resource bounds, and cross-phase regressions.

Every required fault scenario must demonstrate that the requested fault actually occurred before recording a verified result. Fault infrastructure failures must remain distinguishable from no-fault and unavailable outcomes.

## Release boundary

Phase 5 remains an unpublished candidate until its exact-head CI evidence is complete. No package version bump, publication, main merge, or production telemetry deployment claim is implied.
