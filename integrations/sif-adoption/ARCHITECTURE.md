# SIF Adoption Layer Architecture

## Boundary

The frozen SIF Core remains authoritative for product descriptors, capability declarations, authority scopes, request normalization, execution status, response digests, evidence-chain primitives, and replay verification.

The Adoption Layer adds only application-facing coordination around those primitives.

## Components

### SifIntegrationEnvelope

Carries:

- envelope version
- source system
- correlation ID
- requested timestamp
- the SIF product request

The envelope itself is hashed with the Core SHA-256 digest primitive. This gives a stable trace identity without changing the Core request digest.

### SifAdoptionGateway

The gateway:

1. validates and normalizes the envelope
2. computes the envelope digest
3. checks request-level idempotency
4. dispatches to the Core product adapter registry
5. records the Core response in the append-only product evidence ledger
6. verifies replay for responses that carry a valid Core request digest
7. returns the response plus evidence and verification state

No external side effect happens inside the gateway.

### Idempotency

`requestId` is treated as an idempotency key.

A repeated request with the same normalized envelope returns the original execution record without executing its handler again.

A repeated request ID with a different envelope is rejected with `IDEMPOTENCY_CONFLICT`.

The cache is intentionally bounded and FIFO-evicting. The bound protects memory; eviction means idempotency is guaranteed only while the request remains in the bounded cache.

### Product bindings

The default gateway registers the existing Core descriptors for:

- `LARA_OS_REIE`
- `QADRIX`
- `SOVEREIGN_LIBRARY`

Handlers remain explicitly injected by the caller. The Adoption Layer never supplies hidden implementations.

## Safety boundary

The layer deliberately does not add:

- HTTP servers or outbound HTTP clients
- direct PostgreSQL connections
- browser automation
- credentials or secret storage
- queue consumers/producers
- shell/process execution
- automatic authority escalation
- automatic external actions

Those concerns belong in a separate deployment adapter and must preserve the same fail-closed Core contract.
