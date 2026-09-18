# Contributing to SIF

SIF follows:

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

## Branching

- Keep `main` on the preserved Genesis line unless the project design is explicitly changed.
- Use `feat/sif-adoption-layer-1.0.0` for the verified promoted application line.
- The historical SIF Core cumulative preservation line `feat/sif-core-1.0.0-knowledge-semantic` remains preserved as historical source provenance.
- Develop changes on a dedicated branch and merge through a pull request.
- Do not force-push the canonical branch after promotion.

## Verification

Before opening a pull request:

```sh
cd packages/sif-core
npm ci
npm test
```

For Core changes, SIF Core CI is the authoritative exact-checkout verification. For promoted application changes, SIF Adoption Layer CI is the authoritative adoption-line gate, with Core verification retained as a prerequisite.

## Change discipline

Keep changes focused, preserve historical evidence, and do not rewrite promotion records merely to reflect dynamic CI metadata. A passing test run does not by itself establish production security or production deployment readiness.
