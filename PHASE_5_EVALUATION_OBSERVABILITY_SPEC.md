# SIF Phase 5 — Evaluation & Observability Specification

## Status
SPEC ONLY — no Phase 5 runtime capability is claimed by this document.

## Objective
Create an evidence-preserving evaluation and observability plane that correlates events, policy decisions, federation activity, faults, traces, and replayable evaluation results without mutating authoritative history.

## Required areas

1. **Trace/evidence correlation** — stable correlation identifiers across event, policy, federation, worker, and evaluation boundaries.
2. **Structured observability adapter** — dependency-free host boundary for OpenTelemetry-shaped spans, metrics, logs, and links.
3. **Evaluation records** — deterministic suite/case identity, inputs, expected outcomes, measured outcomes, evidence references, and provenance.
4. **Replayable evaluations** — capture enough exact input identity to rerun an evaluation against immutable candidate/state references.
5. **Fault injection** — explicit fault definitions with proof that the intended fault actually occurred before a result is recorded.
6. **Regression suites** — executable cross-phase invariants for kernel, persistence, federation, and governance.
7. **Promotion evidence** — evaluation results bound to exact candidate checkout, test environment and artifact identity.

## Non-goals

- no assumption that OpenTelemetry is available inside the dependency-free kernel;
- no mutable replacement of event history with telemetry;
- no automatic promotion based solely on a telemetry score;
- no production observability deployment claim from kernel tests;
- no hidden fault injection that reports success without proving the fault occurred.

## Security and sovereignty invariants

- telemetry cannot become authority;
- evidence records are immutable by identity and candidate binding;
- trace correlation must not permit cross-tenant or cross-peer identity confusion;
- evaluation inputs must be normalized before hashing;
- unavailable observability backends must not change business authorization semantics;
- fault results distinguish **fault observed**, **fault not observed**, **evaluation failed**, and **evaluation unavailable**.

## Verification boundary

Phase 5 is not promotable until its executable matrix is proven on the exact candidate checkout and the evidence/artifact provenance is exact to that candidate.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`
