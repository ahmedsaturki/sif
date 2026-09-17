# Phase 9 — Test Matrix

All cases are executable in `packages/sif-core/test/sovereign-products.test.ts`.

| ID | Area | Acceptance |
|---|---|---|
| F9-001..F9-010 | Request boundary | deterministic identity, normalization, immutability, timestamp, size and uniqueness validation |
| F9-011..F9-020 | Adapter execution | identity/version/capability/authority/operation enforcement, handler behavior, bounded output |
| F9-021..F9-030 | Response boundary / replay integrity | response normalization, caller immutability, deterministic digests, descriptor isolation, replay verification and tamper detection |
| F9-031..F9-040 | Product adapters | Lara OS/REIE, QADRIX, Sovereign Library identities, capabilities, authority modes and protocol/version pinning |
| F9-041..F9-050 | Registry | registration, uniqueness, bounds, lookup, deterministic listing, dispatch, unknown products and capability limits |
| F9-051..F9-059 | Evidence | append-only records, sequence/linkage, immutability, tamper detection, deterministic chains and limits |
| F9-060 | End-to-end | explicit replay verification across all three sovereign product adapter paths |

No case may grant authority through payload data, skip version pinning, or turn an execution error into `PASS`.
