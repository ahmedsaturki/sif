# SIF Core 0.5.0 Release Notes

## Scope

0.5.0 is the preserved development kernel baseline for SIF. It is intentionally a foundation release, not a claim of a fully integrated distributed production system.

## Included

- append-only event streams and deterministic replay
- optimistic concurrency with explicit PostgreSQL stream-head serialization contract
- SHA-256 event integrity and hash chains
- filesystem content-addressed storage
- evidence/provenance/knowledge/semantic/lineage registries
- scoped, expiring authority and attenuating delegation
- default-deny policy admission with deny-overrides
- durable JSONL and PostgreSQL outbox contracts
- leases/reclaim and inbox idempotency primitives
- resumable projection checkpoints
- Ed25519 attestations
- capability-gated execution
- worker/restart-safe processing primitives
- self-model and reconstruction verification

## Verification

Local baseline:

```text
TypeScript build: PASS
Tests: 27/27 PASS
```

## Known boundaries

Live PostgreSQL wire-level verification, authenticated federation transport, external policy engines, hardware-backed key custody, distributed consensus, production telemetry export and exactly-once external effects are outside the verified 0.5.0 boundary.

## Artifact identity

- source ZIP SHA-256: `3f728ac799be5714efdbbddb80fae98152a3767f339f29ee84750ec1c2687bd5`
- npm TGZ SHA-256: `c1b6d297ebef82523d4e1abc0249497fa702f3bd68bd6fa25d839402cc122abc`

The byte-for-byte artifacts are preserved in the persistent Library; the repository records their identities and the source/test implementation tree.

## Promotion rule

The next release must add evidence, not erase uncertainty. Any new production claim requires its own implementation and verification gate.
