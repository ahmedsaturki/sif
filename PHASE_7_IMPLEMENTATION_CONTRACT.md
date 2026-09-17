# Phase 7 — Implementation Contract

## Invariants

- The model digest is derived from the full registered model identity.
- Returned model, frames, and results are caller-mutable snapshots; internal execution never depends on caller mutation after creation.
- Identifiers referenced by agents, markets, strategies, institutions, and events must resolve or execution fails closed.
- Events are ordered deterministically by `(step, id)` regardless of input ordering.
- Institutional deny rules block matching events before strategy actions are applied.
- Unknown strategy actions, unknown variables, invalid event references, non-finite numbers, and resource overflow are errors rather than implicit behavior.
- Branching is bounded and each branch is independently replayable.
- Repeated execution of the same model and scenario must yield identical result and final-state digests.
- The simulation layer has no external side-effect interface.

## Public boundary

`registerWorldModel` creates a verified world-model identity.
`SystemSimulationEngine.run` executes a bounded deterministic scenario.
`runExperiment` executes bounded independent scenario branches.
`makeSimulationReplayDescriptor` and `verifySimulationReplayDescriptor` bind replay evidence to exact model/scenario/result identity.
`verifyDeterministicSimulation` proves repeat-run equality inside the declared boundary.

## Resource controls

All collections and simulation depth are explicitly bounded by `SystemicEcologicalLimits`. Event payload size and action counts are bounded before execution. Numeric state is finite-only.

## Verification

F7-001..F7-060 are executable in `packages/sif-core/test/systemic-ecological-acceptance.test.ts`. Exact-head SIF Core CI must continue to run the pre-existing strict TypeScript, PostgreSQL, crash-window, archive, and artifact gates.

## Exclusions

No external scheduler, actor runtime, market connector, LLM, network client, autonomous agent executor, real-money engine, production knowledge graph, distributed consensus, or automatic promotion mechanism is part of this phase.
