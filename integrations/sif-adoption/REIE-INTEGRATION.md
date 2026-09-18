# SIF ↔ Lara OS / REIE Integration 1.0.0

This directory now contains an explicit in-process bridge for Lara OS / REIE to invoke the already-defined SIF Adoption contract.

## Boundary

```text
REIE / n8n
   |
   | ReieSifInvocation
   v
createReieSifBridge(...)
   |
   v
SifAdoptionGateway
   |
   v
LARA_OS_REIE adapter
   |
   v
explicit injected handler
   |
   +--> evidence ledger
   +--> replay verification
```

The bridge is deliberately transport-neutral. It does not create an HTTP server, connect to PostgreSQL, access browser credentials, or execute shell commands. A deployment adapter can call the bridge from an n8n Code/Function node or another REIE worker while preserving the same SIF boundary.

## REIE contract

Every invocation must provide:

- a stable `requestId`
- a SIF operation
- requested capability identifiers
- authority scopes
- public evidence references
- a JSON-safe payload
- a correlation ID
- an ISO-8601 timestamp

The bridge fixes `productId=LARA_OS_REIE` and `adapterVersion=1.0.0`. SIF remains authoritative for capability, authority, operation, size, evidence, and replay enforcement.

## Current operations

`policy.check`, `knowledge.query`, `evaluation.run`, `systemic.query`, and `continuity.read` are exposed through the existing Core descriptor.

The convenience functions only fill the default capability identifier. The caller still supplies authority scopes and evidence references explicitly.

## Deployment rule

This commit establishes the code-level integration boundary. It does **not** claim that the live n8n REIE workflow has been modified. Live deployment requires access to the running n8n/VPS workspace and should be performed as a separate operator-controlled deployment step.

