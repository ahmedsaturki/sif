# Phase 7 — Test Matrix

| ID | Acceptance target |
|---|---|
| F7-001..F7-020 | model identity, references, resource validation, event validation |
| F7-021..F7-040 | deterministic strategy execution, institutional blocking, ordering, state isolation |
| F7-041..F7-060 | bounded experiments, replay identity, determinism, semantic-state integrity, final end-to-end chain |

Every row is executable in `packages/sif-core/test/systemic-ecological-acceptance.test.ts`.

A row is considered verified only when the exact branch HEAD passes the committed acceptance suite and the full SIF Core CI verification workflow.
