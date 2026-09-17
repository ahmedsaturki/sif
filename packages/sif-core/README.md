# SIF Core 0.5.0

Dependency-free TypeScript kernel for a Sovereign Intelligence Fabric.

## Installation and import

The package is ESM-first and exposes the built `src/index.ts` surface from the package root.

```sh
npm install ./sif-core-0.5.0.tgz
```

```js
import { InMemoryEventStore, SifEventWriter, digest } from "sif-core";
```

The package includes compiled JavaScript, TypeScript declarations, and the PostgreSQL schema under `sql/`. It does not require runtime npm dependencies.

## Included in the package

- append-only event streams with optimistic concurrency
- deterministic replay and projections
- SHA-256 event integrity / stream hash chains
- filesystem content-addressed storage (CAS)
- evidence / provenance / semantic registries
- scoped, expiring authority and attenuating delegation
- default-deny policy admission with deny-overrides
- durable JSONL outbox and inbox idempotency primitives
- transactional PostgreSQL event + outbox adapter
- PostgreSQL stream-head serialization and projection metadata
- Ed25519 attestations and capability-gated execution
- lineage / reconstruction verification
- Secure Federation, Policy & Governance, and Evaluation & Observability boundaries
- Knowledge / Semantic Plane: immutable ontology versions, semantic compatibility, epistemic knowledge, provenance graph, semantic replay, and legacy handoff
- Systemic / Ecological Plane: deterministic bounded world models, scenario events, strategy actions, institutions, experiments, and replay
- Reflexive / Continuity Plane: self-model, snapshots, lineage, controlled improvement, succession, preservation manifests, and reconstruction verification
- Sovereign Products Plane: version-pinned product adapters, fail-closed capability/authority/version/operation enforcement, append-only evidence, and replay verification

## Current candidate

The package identity remains `sif-core@0.5.0`. Later phases are preserved on the canonical cumulative branch as verified implementation history; preservation does not imply a registry publication.

## Verification boundary

Exact-head SIF Core CI verifies checkout identity, strict build/tests, package acceptance coverage, live PostgreSQL integration, federation and PostgreSQL crash-window characterization, candidate archive construction/verification, packed-package import resolution, and artifact upload. A successful candidate run is evidence for that exact source checkout only.

Production distributed knowledge graphs, external ontology registries, semantic consensus, automatic truth determination, KMS/HSM integration, distributed consensus, exactly-once external side effects, automatic authority promotion, direct external integrations, autonomous external actions, and registry publication remain outside this candidate boundary.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

The package version remains `0.5.0` until an explicit promotion/release decision.
