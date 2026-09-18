# REIE Governed Host 2.1.0

This package is the executable composition boundary for the REIE operational platform.

It composes:
- SIF Core product controls through the SIF Adoption Gateway
- REIE Local Core and operational runtime
- a local allowlist-based policy handler for safe REIE agents
- the loopback-only REIE API and dashboard
- the public-source browser collection boundary through the separate browser-worker package

The host does not modify the frozen SIF Core and does not inject credentials, automate login, submit forms, or perform outreach.

## Run

Build the sibling Core, Adoption, REIE runtime, and browser worker packages first, then:

```sh
cd integrations/lara-os-reie-host
npm run build
node dist/cli.js serve ./data/reie-events.jsonl 8787
```

The server binds to 127.0.0.1 and enables the safe REIE agent set by default: content, qa, research, and strategy.

The policy gate is implemented through a real `LARA_OS_REIE` SIF Adoption request, so agent execution is not a direct bypass around SIF.

## Public-source collection

`ReiePublicSourceCollector` connects a Playwright browser worker to a REIE ingestion target. Browser capture becomes a source-only record; semantic claims still require an explicit extraction rule and human review in the REIE runtime.

## Public source collection CLI

The host can capture a public HTTP(S) page into the REIE journal without semantic inference:

```sh
node dist/cli.js collect ./data/reie-events.jsonl source-1 https://example.com ./data/browser-profile
```

The browser worker uses a persistent profile directory. Any session state in that profile remains under human control. Captured unstructured text is stored as source evidence only; entity/claim creation still requires explicit ingestion or reviewed extraction.
