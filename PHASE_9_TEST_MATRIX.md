# Phase 9 — Test Matrix

All cases are executable in `packages/sif-core/test/sovereign-products.test.ts`.

| ID | Area | Acceptance |
|---|---|---|
| F9-001..F9-010 | Request boundary | deterministic identity, normalization, immutability, timestamp, size and uniqueness validation |
| F9-011..F9-020 | Adapter execution | identity/version/capability/authority/operation enforcement, handler behavior, bounded output |
| F9-021..F9-030 | Product adapters | Lara OS/REIE, QADRIX, Sovereign Library descriptors and explicit capability sets |
| F9-031..F9-040 | Registry | uniqueness, bounds, lookup, deterministic listing, dispatch, unknown products |
| F9-041..F9-050 | Evidence | append-only records, sequence/linkage, immutability, tamper detection and limits |
| F9-051..F9-060 | Replay / end-to-end | replay identity, digest tamper detection, deterministic ordering and all product paths |

No case may grant authority through payload data, skip version pinning, or turn an execution error into `PASS`.
