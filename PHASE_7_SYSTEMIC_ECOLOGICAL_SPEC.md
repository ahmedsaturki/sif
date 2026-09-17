# Phase 7 — Systemic / Ecological Plane Specification

## Purpose

Phase 7 adds a dependency-free, deterministic world-model boundary for bounded systemic experiments. It represents players, agents, strategies, markets, institutions, state variables, and scheduled events without producing real-world side effects.

## Required capabilities

1. Canonical world-model registration with deterministic content identity.
2. Explicit player, agent, strategy, market, and institution references.
3. Bounded numeric state and finite-state evolution primitives.
4. Deterministic scheduled-event simulation with stable event ordering.
5. Institutional blocking as a fail-closed simulation rule.
6. Strategy-driven actions limited to SET, ADD, and MULTIPLY over declared variables.
7. Bounded scenario branching for world-model experiments.
8. Deterministic simulation replay descriptors bound to model, scenario, and result identity.
9. Repeat-run determinism verification.
10. Explicit resource ceilings for model size, events, steps, payloads, actions, and branches.

## Sovereignty boundary

The engine is a pure simulation/evaluation component. It does not call external services, send network messages, mutate PostgreSQL, execute shell commands, control agents in the physical world, or authorize external side effects. Simulation outputs are evidence for the tested model only.

## Semantic relationship

Phase 7 consumes the identity and provenance discipline established earlier without silently changing semantic truth. A simulated result is a simulated result; it must not be reclassified as observed or production evidence by this layer.

## Release boundary

No package version bump, publication, merge to `main`, production market/agent/institution deployment claim, autonomous action claim, or automatic promotion is implied.
