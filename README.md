# SIF

Software Integration Foundation — reusable integration contracts and adoption boundaries.

## Status

The SIF adoption boundary is implemented on `main` and covered by automated tests. SIF is now treated as a consumer-facing foundation rather than a project that should be repeatedly rebuilt.

## Canonical portfolio map

See [PORTFOLIO-EXECUTION-ROADMAP.md](PORTFOLIO-EXECUTION-ROADMAP.md) for:

- the canonical platform/consumer architecture
- consumer adoption rules
- Definition of Done
- release and verification gates
- the execution order for Lara OS / REIE, QADRIX / QRX, and Sovereign Library
- the distinction between verified work and intentionally gated external evidence

## Boundary rule

SIF owns reusable integration primitives and stable contracts.

Consumer projects own domain-specific:

- business logic
- workflows
- entities
- persistence semantics
- product behavior
- user-facing decisions

A consumer should **consume SIF contracts, not copy SIF internals**.

## Verification rule

Code existence does not equal live verification.

A capability is only treated as complete at the level actually evidenced by its:

- implementation
- tests
- CI
- deployment
- runtime verification
- authorization
- release state

Governed repositories keep explicit evidence/authorization gates and do not silently convert blocked or pending evidence into "done".
