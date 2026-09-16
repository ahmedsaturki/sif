# SIF Engineering Decisions

## D001 — Event history is authoritative
Events are immutable history. Current state is reconstructed through projections/replay; snapshots and caches are derived data.

## D002 — Stream serialization is explicit
PostgreSQL per-stream writes use a dedicated `sif_stream_heads` row as the serialization point. `MAX(stream_version)` alone is not treated as a safe concurrency primitive.

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
Conceptual architecture, research patterns and future targets are preserved as knowledge but never represented as implemented runtime features without code and verification evidence.

## D011 — Binary artifacts use a dedicated preservation channel
Because the available repository connector is text-safe, byte-for-byte binary release artifacts are preserved in the persistent Library with cryptographic identity recorded in Git. GitHub release assets remain the future publication mechanism.
