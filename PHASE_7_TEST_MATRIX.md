# SIF Phase 7 — Systemic / Ecological Plane Test Matrix

Required executable acceptance rows: **F7-001..F7-060**.

- **F7-001..F7-012 — Identity/population:** deterministic simulation identity, agent/player creation, immutability, duplicate rejection, population bounds, stable IDs and caller-isolated reads.
- **F7-013..F7-024 — Strategies/transitions:** deterministic strategy identity, valid transitions, invalid transitions, state capture, transition ordering, bounded strategy definitions and replayable strategy events.
- **F7-025..F7-034 — Institutions/authority isolation:** institution identity, role constraints, policy references, role immutability, explicit scope, and proof that simulation metadata cannot widen runtime authority.
- **F7-035..F7-044 — Resources/markets:** resource bounds, deterministic ledger updates, insufficient-resource rejection, deterministic order matching, price/time/ID tie-breaks, and immutable clearing evidence.
- **F7-045..F7-052 — Dynamics/scheduler:** bounded ticks, deterministic event ordering, duplicate event handling, invalid timestamps, event limits, state transitions, and resource-safe execution.
- **F7-053..F7-060 — Replay/evidence:** deterministic snapshot digests, replay mismatch rejection, seed/scenario binding, knowledge/policy/federation/evaluation evidence attribution, and authority non-escalation.

## Pass condition

All 60 rows execute and pass against the exact candidate checkout. Code presence or plausible output is not proof.
