# Contributing to SIF

SIF follows:

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

## Branching

- Keep `main` on the preserved Genesis line unless the project design is explicitly changed.
- Use `feat/sif-core-1.0.0-knowledge-semantic` for the verified promoted cumulative line.
- Develop changes on a dedicated branch and merge through a pull request.
- Do not force-push the canonical branch after promotion.

## Verification

Before opening a pull request:

```sh
cd packages/sif-core
npm ci
npm test
```

The GitHub SIF Core CI is the authoritative exact-checkout verification for the candidate commit.

## Change discipline

Keep changes focused, preserve historical evidence, and do not rewrite promotion records merely to reflect dynamic CI metadata. A passing test run does not by itself establish production security or production deployment readiness.
