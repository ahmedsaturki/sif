# SIF — Sovereign Intelligence Fabric

SIF is a sovereignty-first intelligence fabric whose implementation begins with a small, verifiable TypeScript kernel and grows through evidence-gated integration layers.

## Current candidate line

- Verified kernel baseline is preserved.
- Phase 2 Live PostgreSQL verification remains preserved by later candidate CI.
- Phase 3 Secure Federation remains an unpublished implementation candidate on its dedicated feature branch.
- Phase 4 Policy & Governance remains an unpublished implementation candidate on `feat/sif-core-0.8.0-policy-governance`.
- Phase 5 Evaluation & Observability is the current unpublished implementation candidate on `feat/sif-core-0.9.0-evaluation-observability`.
- The package version remains `0.5.0`; later milestones do not imply package publication.

## Phase 5 Evaluation & Observability

The Phase 5 candidate adds a dependency-free evaluation/observability boundary for bounded trace correlation, structured TRACE/METRIC/LOG observations, deterministic evaluation evidence, candidate/artifact/environment-bound replay, explicit fault execution proof, bounded parallel regression suites, and fail-closed promotion evidence.

The executable acceptance suite is F5-001..F5-060 in `packages/sif-core/test/evaluation-observability-acceptance.test.ts`, with an additional regression test proving measured-vs-expected mismatch semantics. Exact-head CI retains the existing persistence, crash-window, archive, and artifact verification gates.

## Verification boundary

A passing exact-head CI result is evidence for the exact source candidate only. It is not a production deployment, external observability-provider deployment, OpenTelemetry SLA, HA/performance claim, or registry publication claim.

## Release discipline

`SPEC → IMPLEMENT → TEST → FIX → VERIFY → RELEASE → FREEZE → NEXT`

Promotion requires a separate explicit decision. No merge to `main`, version bump, or registry publication is implied by candidate verification.

## License

Apache-2.0. See `LICENSE`.
