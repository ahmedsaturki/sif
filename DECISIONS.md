# SIF Engineering Decisions

## D001 — Event history is authoritative
Events are immutable history. Current state is reconstructed through projections/replay; snapshots and caches are derived data.

## D002 — Stream serialization is explicit
PostgreSQL per-stream writes use a dedicated stream-head serialization point rather than treating `MAX(stream_version)` as sufficient concurrency control.

## D003 — Trust does not imply authority
Provenance, signatures and trust-domain membership do not automatically grant permission. Authority is scoped, time-bounded and explicitly admitted.

## D004 — Deny overrides allow
The default policy is deny. Where rules conflict, an explicit deny wins.

## D005 — Retry requires idempotency
Durable delivery, retries and reclaim are designed around event/message identity and consumer-side idempotency. Exactly-once external effects are not claimed.

## D006 — Self-healing is bounded
Self-healing means recovery within protected authority and promotion boundaries. It is not permission for uncontrolled self-modification.

## D007 — Evidence is first-class
A capability is not promoted because implementation exists. Promotion requires reproducible verification evidence and explicit boundary documentation.

## D008 — Semantic history is versioned
Labels, identifiers and mappings may change meaning. Historical semantics are preserved rather than overwritten by current interpretations.

## D009 — Federation preserves local sovereignty
Remote domains may provide messages and evidence, but remote authority is never silently converted into local authority.

## D010 — Research and implementation stay separate
Conceptual architecture and research patterns are knowledge inputs, not implementation evidence.

## D011 — Binary artifacts use a dedicated preservation channel
Byte-for-byte binary release artifacts are preserved through the repository/CI artifact path until an explicit publication boundary exists.

## D012 — Telemetry is observational, not authoritative
Trace, metric and log records correlate and explain execution but do not mutate event history, grant authority, or override authorization decisions.

## D013 — Fault success requires proof
A requested fault is recorded as observed only when the execution boundary supplies explicit evidence of occurrence. No-fault, evaluator failure, and unavailable outcomes remain distinct.

## D014 — Meaning is versioned, not silently migrated
Ontology versions are immutable semantic identities. Compatibility is an explicit decision; ambiguous mappings never become implicit compatibility.

## D015 — Knowledge is epistemic, not authoritative
Evidence-qualified knowledge records preserve status, scope, time and provenance. Knowledge, confidence, provenance, or semantic compatibility cannot by themselves grant or widen authority.

## D016 — Legacy handoff preserves provenance
Legacy knowledge is adopted through an explicit boundary that preserves source identity and semantic version while recording that authority was not widened.
