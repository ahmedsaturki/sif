# SIF Phase 5 — Evaluation & Observability Evidence Ledger

## Purpose
This ledger maps every required Phase 5 acceptance row to an executable test in `packages/sif-core/test/evaluation-observability-acceptance.test.ts` and identifies the runtime boundary it proves.

## Acceptance mapping

| Row | Executable proof | Boundary |
|---|---|---|
| F5-001 | `test("F5-001", ...)` | trace normalization + deterministic digest |
| F5-002 | `test("F5-002", ...)` | deterministic context equality |
| F5-003 | `test("F5-003", ...)` | parent-span correlation |
| F5-004 | `test("F5-004", ...)` | empty trace ID rejection |
| F5-005 | `test("F5-005", ...)` | empty span ID rejection |
| F5-006 | `test("F5-006", ...)` | empty correlation ID rejection |
| F5-007 | `test("F5-007", ...)` | baggage entry bound |
| F5-008 | `test("F5-008", ...)` | baggage byte bound |
| F5-009 | `test("F5-009", ...)` | baggage propagation |
| F5-010 | `test("F5-010", ...)` | caller-immutability of normalized baggage |
| F5-011 | `test("F5-011", ...)` | deterministic observation identity |
| F5-012 | `test("F5-012", ...)` | structured observation attributes |
| F5-013 | `test("F5-013", ...)` | invalid observation name rejection |
| F5-014 | `test("F5-014", ...)` | invalid timestamp rejection |
| F5-015 | `test("F5-015", ...)` | observation attribute bound |
| F5-016 | `test("F5-016", ...)` | observation payload bound |
| F5-017 | `test("F5-017", ...)` | evidence-reference caller isolation |
| F5-018 | `test("F5-018", ...)` | immutable sink reads |
| F5-019 | `test("F5-019", ...)` | bounded sink capacity |
| F5-020 | `test("F5-020", ...)` | observation backend failure isolation |
| F5-021 | `test("F5-021", ...)` | deterministic evaluation identity |
| F5-022 | `test("F5-022", ...)` | candidate provenance |
| F5-023 | `test("F5-023", ...)` | environment provenance |
| F5-024 | `test("F5-024", ...)` | input digest |
| F5-025 | `test("F5-025", ...)` | expected/measured digests |
| F5-026 | `test("F5-026", ...)` | PASS status |
| F5-027 | `test("F5-027", ...)` | failure capture |
| F5-028 | `test("F5-028", ...)` | evidence references |
| F5-029 | `test("F5-029", ...)` | evaluation input byte bound |
| F5-030 | `test("F5-030", ...)` | caller-immutability of evaluation input |
| F5-031 | `test("F5-031", ...)` | replay candidate identity |
| F5-032 | `test("F5-032", ...)` | replay artifact identity |
| F5-033 | `test("F5-033", ...)` | successful replay identity verification |
| F5-034 | `test("F5-034", ...)` | replay candidate mismatch |
| F5-035 | `test("F5-035", ...)` | replay artifact mismatch |
| F5-036 | `test("F5-036", ...)` | replay input mismatch |
| F5-037 | `test("F5-037", ...)` | replay expected-result mismatch |
| F5-038 | `test("F5-038", ...)` | deterministic replay descriptor |
| F5-039 | `test("F5-039", ...)` | empty artifact identity rejection |
| F5-040 | `test("F5-040", ...)` | replay environment binding |
| F5-041 | `test("F5-041", ...)` | true bounded regression parallelism |
| F5-042 | `test("F5-042", ...)` | regression failure capture |
| F5-043 | `test("F5-043", ...)` | regression observation emission |
| F5-044 | `test("F5-044", ...)` | regression candidate propagation |
| F5-045 | `test("F5-045", ...)` | regression case-count bound |
| F5-046 | `test("F5-046", ...)` | observed fault requires evidence |
| F5-047 | `test("F5-047", ...)` | requested fault not observed |
| F5-048 | `test("F5-048", ...)` | evaluator execution failure classification |
| F5-049 | `test("F5-049", ...)` | unavailable fault evaluator classification |
| F5-050 | `test("F5-050", ...)` | finite fault action budget |
| F5-051 | `test("F5-051", ...)` | no-op observability backend |
| F5-052 | `test("F5-052", ...)` | empty candidate promotion evidence rejection |
| F5-053 | `test("F5-053", ...)` | empty artifact promotion evidence rejection |
| F5-054 | `test("F5-054", ...)` | INDETERMINATE promotion rejection |
| F5-055 | `test("F5-055", ...)` | UNAVAILABLE promotion rejection |
| F5-056 | `test("F5-056", ...)` | non-required fault classification accepted |
| F5-057 | `test("F5-057", ...)` | multiple passing evaluation evidence |
| F5-058 | `test("F5-058", ...)` | evaluation-to-observation evidence linkage |
| F5-059 | `test("F5-059", ...)` | trace context identity preserved in evaluation evidence |
| F5-060 | `test("F5-060", ...)` | end-to-end regression result + promotion evidence |

## Exact-head verification rule

A row is verified only when the exact candidate checkout has passed the full SIF Core CI workflow, including strict build/tests, live PostgreSQL integration, both crash-window characterizations, candidate archive build/verification, and candidate artifact upload.

## Provenance boundary

- Candidate identity is the branch HEAD checked out by CI.
- Artifact identity is the unpublished candidate archive produced by that same CI run.
- Dynamic CI run IDs and artifact IDs are deliberately not committed into mutable repository state files.
- A successful Phase 5 ledger does not claim production OpenTelemetry deployment, production-scale observability, or automatic promotion.
