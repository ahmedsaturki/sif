# Phase 8 — Reflexive / Continuity Plane Specification

## Objective
Provide a dependency-free, bounded continuity boundary for self-model verification, controlled self-improvement, reconstruction, succession, identity lineage, and long-term preservation.

## Invariants
1. Continuity state is immutable by identity: every snapshot has deterministic state and self-model digests.
2. Lineage is append-only and acyclic. Missing parents, self-parenting, duplicate identifiers, and excessive ancestry fail closed.
3. Self-model truth is evidence-bound. A mismatch in declared capability state is a hard continuity failure.
4. Self-improvement is proposal-based. A proposal is derived from an exact base snapshot, requires explicit evaluation evidence, and may preserve or narrow authority only.
5. Candidate preparation never performs external side effects, mutates event history, changes policy, grants authority, or writes to another system.
6. Succession is explicit. A successor has a distinct identity, exactly one generation increment, and no broader authority scopes than its predecessor.
7. Reconstruction is verifiable from immutable snapshot, lineage, and preservation identities. A mismatch is reported rather than silently repaired.
8. Preservation manifests identify every preserved file plus artifacts and event-stream heads by cryptographic digest.
9. All resource ceilings are executable and bounded.
10. Simulation, knowledge, policy, evaluation, and telemetry inputs are evidence references; none can silently become authority.

## Non-Goals
No autonomous self-modification, automatic promotion, external deployment, remote execution, network orchestration, key management, or truth determination from self-model data is implemented by this phase.
