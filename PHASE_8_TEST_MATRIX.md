# Phase 8 — Test Matrix

All cases are executable in `packages/sif-core/test/reflexive-continuity.test.ts`.

| ID | Requirement |
|---|---|
| F8-001 | self-model digest deterministic |
| F8-002 | self-model identity affects digest |
| F8-003 | matching self-model verification passes |
| F8-004 | self-model mismatch fails closed |
| F8-005 | snapshot state digest deterministic |
| F8-006 | snapshot binds self-model digest |
| F8-007 | snapshot timestamp canonicalization |
| F8-008 | empty identity rejected |
| F8-009 | invalid timestamp rejected |
| F8-010 | oversized state rejected |
| F8-011 | artifact ceiling enforced |
| F8-012 | duplicate artifact rejected |
| F8-013 | snapshot state caller-immutable |
| F8-014 | intact snapshot verifies |
| F8-015 | tampered snapshot rejected |
| F8-016 | lineage parent ceiling enforced |
| F8-017 | self-parent rejected |
| F8-018 | unknown parent rejected |
| F8-019 | lineage ordering deterministic |
| F8-020 | lineage cycle rejected |
| F8-021 | ancestry depth ceiling enforced |
| F8-022 | append lineage preserves graph |
| F8-023 | duplicate lineage node rejected |
| F8-024 | lineage digest deterministic |
| F8-025 | improvement base identity binding |
| F8-026 | improvement base snapshot binding |
| F8-027 | target state digest produced |
| F8-028 | authority widening rejected |
| F8-029 | oversized target state rejected |
| F8-030 | proposal digest deterministic |
| F8-031 | proposal evidence preserved |
| F8-032 | passing evaluation approves review |
| F8-033 | failed evaluation rejects review |
| F8-034 | wrong-proposal evaluation rejects review |
| F8-035 | missing required evaluation rejects review |
| F8-036 | improvement base mismatch rejected |
| F8-037 | unapproved improvement rejected |
| F8-038 | improvement can narrow scopes |
| F8-039 | improvement increments generation |
| F8-040 | improvement is explicitly non-widening |
| F8-041 | succession requires distinct identity |
| F8-042 | succession requires one generation increment |
| F8-043 | succession widening rejected |
| F8-044 | succession certificate verifies |
| F8-045 | tampered succession rejected |
| F8-046 | preservation manifest deterministic |
| F8-047 | duplicate preservation path rejected |
| F8-048 | intact preservation verifies |
| F8-049 | tampered preservation rejected |
| F8-050 | coherent reconstruction verifies |
| F8-051 | reconstruction identity mismatch surfaced |
| F8-052 | reconstruction preservation mismatch surfaced |
| F8-053 | archive binds snapshot and lineage |
| F8-054 | intact archive verifies |
| F8-055 | archive digest tampering rejected |
| F8-056 | proposal store bounded |
| F8-057 | proposal store returns immutable data |
| F8-058 | certificate store bounded |
| F8-059 | store exposes bounded counts |
| F8-060 | reconstruction remains deterministic |
