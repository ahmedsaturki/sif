# REIE Operational Platform 2.0.0

## Scope

REIE 2.0.0 extends the verified Local Core 1.0 boundary without changing the frozen SIF Core.

## Delivered

- deterministic ingestion for explicit JSON and explicitly mapped CSV
- source-only preservation for unstructured text
- deterministic entity and claim identifiers
- candidate-only text extraction with evidence spans
- human review queue before semantic claims are committed
- durable operational journal for review items, explicit relations, and agent runs
- explicit relation graph with source evidence
- deterministic price history and price-change projection
- deterministic opportunity projection from signals and research priority
- fail-closed agent orchestration with an explicit SIF governance gate
- local loopback HTTP API for health, knowledge, opportunities, extraction, ingestion, review, relations, and agent-run visibility
- CLI ingestion, opportunity, and local-server commands
- optional Playwright browser worker with persistent profiles, host allowlists, text capture, and screenshots
- CI coverage for SIF Core, SIF Adoption, REIE runtime, operational API, and the optional browser worker

## Safety and authority boundary

The REIE core and operational layer do not inject credentials, automate login, submit forms, perform outreach, automatically merge entities, or infer facts from unstructured text without an explicit extraction rule followed by human review.

Browser automation is isolated in a separate package. The worker is collection-oriented and defaults to HTTP(S) navigation only.

## Verification model

Acceptance requires:

1. frozen SIF Core verification
2. SIF Adoption build and tests
3. REIE runtime build and tests
4. operational end-to-end API tests
5. browser worker TypeScript build and safety tests
6. real Chromium local-fixture smoke test in CI

## Runtime

The REIE runtime remains dependency-free. The browser worker is the only optional dependency-bearing package and uses the pinned Playwright release documented in its README.

## Known extension points

Provider/model inference, entity-resolution automation, external queues, PostgreSQL persistence, scheduled crawlers, and product-specific dashboards can be connected above these contracts without changing the frozen SIF Core API.
