# SIF Phase 7 — Systemic / Ecological Plane Implementation Contract

## Runtime

Implement one dependency-free systemic boundary around existing event/replay/authority primitives.

### Required public components
- `SystemicSimulationLimits` with population, strategy, institution, resource, event, tick, payload, and replay bounds.
- immutable `SimulationAgent` / `SimulationPlayer` identities and state snapshots;
- explicit `SimulationStrategy` definitions and deterministic transition records;
- `SimulationInstitution` with roles and policy references as simulation metadata only;
- deterministic resource ledger and market/order matching primitive;
- bounded event scheduler and ordered simulation event log;
- deterministic scenario state and tick advancement;
- replay and snapshot digest verification;
- evidence references for knowledge/policy/federation/evaluation inputs;
- typed errors for invalid transitions, conflicts, bounds, and replay mismatch.

## Security / sovereignty

Simulation entities, market positions, institution roles, strategy state, or model outputs never grant SIF authority. Existing authority primitives remain the only authority source.

Remote/federated facts are accepted only as attributed evidence. A simulation may consume them as scenario inputs without converting them to authorization.

## Determinism

Given the same scenario, ordered event log, and seed, replay must produce the same snapshot digest. Matching order uses explicit deterministic tie-breaks, never process timing.

## Resource safety

All public operations must enforce finite limits. No recursive/unbounded simulation path is permitted.

## Verification

F7-001..F7-060 must be executable acceptance tests covering identity, strategy transitions, institution boundaries, market/resource mechanics, scheduler/ticks, replay, evidence binding, limits, and cross-phase authority isolation.

## Release boundary

No package version bump, production simulator deployment, market forecasting claim, autonomous external action, or authority promotion is implied.
