# SIF Phase 7 — Systemic / Ecological Plane Specification

## Objective
Provide a deterministic, bounded world-model layer over the event/authority/knowledge foundation for simulation and systemic analysis without treating simulation as production reality.

## Required capabilities

1. Typed players/agents with immutable identity and bounded population.
2. Explicit strategies and state transitions with deterministic strategy identity.
3. Institutions with scoped roles/policy references that never grant authority implicitly.
4. Resource/market mechanisms for bounded experiments with deterministic matching/clearing.
5. System-dynamics state and deterministic event scheduling.
6. Scenario/environment definitions with bounded ticks, events, and state payloads.
7. Simulation event log, snapshot digest, and deterministic replay.
8. Cross-phase evidence links to knowledge, policy, federation, and evaluation without authority escalation.
9. Fail-closed invalid transitions and executable resource limits.

## Non-goals

- no claim of predicting real markets or society;
- no autonomous real-world action;
- no hidden authority from agent/institution/market status;
- no unbounded agent populations or event loops;
- no external simulation dependency in the kernel;
- no production world-model deployment claim.

## Invariants

- identity is stable within a simulation;
- state is reproducible from scenario + ordered simulation events;
- strategy changes are explicit events;
- institutions can constrain simulation behavior but do not become runtime authority;
- remote/knowledge inputs remain evidence until separately admitted;
- resource limits are executable;
- replay mismatch fails closed.

## Verification

F7-001..F7-060 must be executable against the exact candidate checkout.
