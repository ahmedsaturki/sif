# Phase 9 — Implementation Contract

The product adapter layer is deliberately narrow.

### Public boundary
`SifProductAdapter` exposes one descriptor and one asynchronous `execute` operation. Product-specific code enters only through explicitly injected `ProductOperationHandler` functions.

### Descriptor rules
- productId, adapterVersion, protocolVersion, capability IDs, authority scopes, and operations are explicit and immutable to callers.
- every capability declares a plane, version, mode, and required authority scopes.
- a capability may not require authority absent from the descriptor.

### Request rules
- request identity, product, adapter version, operation, timestamps, capabilities, authority scopes, and evidence IDs are validated.
- arrays are unique and normalized deterministically.
- payload size is bounded.
- request digest is calculated from normalized request identity, not from mutable caller state.

### Execution rules
- product identity and adapter version must match exactly.
- operation must be declared and have a bound handler.
- every requested capability must be exposed.
- every requested capability's required authority scopes must be present in the request.
- request authority must remain within descriptor authority.
- handler exceptions never become `PASS`; they become `INDETERMINATE`.
- response output is bounded and caller-immutable.

### Registry rules
- one adapter per product ID.
- adapter count is bounded.
- descriptors are returned in deterministic product-ID order.
- unknown products are `UNAVAILABLE`.

### Evidence rules
`InMemoryProductEvidenceLedger` stores bounded records with sequence, request digest, response digest, timestamp, previous record digest, and record digest. Verification checks both sequence/linkage and every record hash.

### Replay rules
`verifySifProductReplay` recomputes the normalized request digest and response digest. Any mismatch produces `REPLAY_MISMATCH`.

### Security boundary
The adapter layer does not grant a product new authority. Product IDs and authority scopes are structural metadata, not payload-controlled escalation. External I/O, credentials, transport, deployment, and persistence remain outside this package boundary.
