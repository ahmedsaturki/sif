# SIF Phase 3 — Secure Federation Implementation Contract

## Status
IMPLEMENTATION CONTRACT — design/control boundary. Runtime implementation is not claimed by this document.

This contract refines `PHASE_3_FEDERATION_SPEC.md` into independently implementable components, interfaces, invariants, and promotion gates.

## Source of Truth
Phase 3 must preserve the existing SIF laws:

- immutable local event history is authoritative;
- remote trust does not create local authority;
- MESSAGE IDENTITY and EVENT IDENTITY are distinct;
- retry requires idempotency;
- recovery requires reconciliation;
- configured != live != usable != production-safe;
- evidence must identify exact candidate content;
- semantic compatibility is required in addition to syntactic compatibility;
- unknown outcome is distinct from failure and success.

## Dependency Rule
The SIF Core kernel remains dependency-free. Federation implementations MUST live behind adapters/extensions. A mandatory TLS/SPIFFE runtime dependency must not be introduced into the kernel package merely to enable federation.

## Component Boundaries

### F1 — Peer Identity Adapter
Responsibilities:
- authenticate the transport peer;
- expose canonical peer/workload identity;
- bind identity to the authenticated session;
- reject unauthenticated or identity-mismatched peers.

Inputs:
- transport session;
- presented identity material;
- local trust configuration.

Outputs:
- authenticated peer identity or a typed authentication failure.

Must not:
- grant application authority;
- mutate local event history;
- infer business permissions from identity alone.

### F2 — Trust Bundle Registry
Responsibilities:
- version trust roots/bundles;
- support explicit activation and retirement;
- record provenance and effective times;
- reject unknown/untrusted issuers.

Required properties:
- deterministic lookup;
- explicit version identity;
- audit/evidence linkage;
- rotation without silently widening trust.

### F3 — Federation Envelope
Required fields, with stable semantic identities:
- protocol id/version;
- schema id/version;
- sender domain id;
- peer/workload identity reference;
- message id;
- optional event id;
- optional evidence id;
- occurrence/creation timestamps with declared semantics;
- provenance reference;
- integrity/signature reference;
- replay/idempotency key;
- negotiated capability context.

Rules:
- `message_id` MUST uniquely identify a delivered message identity within its declared scope;
- `event_id` MUST identify an event independently of message delivery;
- one event may be transported by multiple messages only when explicitly permitted;
- a message MUST NOT silently become an event.

### F4 — Canonical Signing Layer
Responsibilities:
- construct canonical signed bytes;
- verify signature before semantic admission;
- bind sender identity, envelope identity, and signed content;
- reject tampering and ambiguous canonical representations.

The signing contract MUST specify:
- canonicalization version;
- algorithm identifier;
- key/identity reference;
- signature encoding;
- signed-field set;
- verification failure taxonomy.

### F5 — Capability Negotiation
Negotiates:
- protocol versions;
- envelope versions;
- supported authentication modes;
- supported signature algorithms;
- replay/idempotency features;
- reconciliation modes;
- ordering guarantees;
- maximum message/attachment sizes.

Rules:
- unsupported mandatory capabilities fail closed;
- negotiated capabilities are session-scoped unless explicitly persisted as a versioned configuration;
- negotiation does not grant local authority;
- semantic incompatibility is a failure even when schemas are syntactically compatible.

### F6 — Durable Federation Inbox
Responsibilities:
- persist accepted message identity before effect commitment where required;
- provide duplicate detection;
- preserve processing/commit/verification distinctions;
- support replay-safe recovery.

Required state distinction:
`DELIVERED != PROCESSED != COMMITTED != VERIFIED`.

The inbox MUST support deterministic behavior for duplicate, delayed, reordered, and redelivered messages.

### F7 — Local Admission Boundary
Responsibilities:
- evaluate peer/message/evidence context under local policy;
- produce an explicit local authorization decision;
- prevent remote commands from becoming local effects merely because transport authentication succeeded.

Required decision inputs:
- authenticated peer identity;
- message/envelope identity;
- provenance;
- negotiated capability context;
- operation/effect class;
- local policy version;
- local resource/security constraints.

Decision output MUST be attributable, scoped, and time-bounded where authority is granted.

### F8 — Reconciliation Engine
Allowed initial scope:
- evidence exchange;
- event/reference exchange;
- bounded cursor-based synchronization.

Not implicitly allowed:
- remote state overwrite;
- distributed consensus;
- automatic bidirectional authority;
- hidden conflict resolution.

Conflicts MUST be represented explicitly as observations/evidence/conflict records, preserving both sides of the conflict.

### F9 — Delivery / Retry Controller
Responsibilities:
- classify delivery outcomes;
- retry only idempotent operations after retry admission;
- enforce backpressure and resource bounds;
- prevent retry storms from bypassing admission controls.

At minimum distinguish:
- unavailable peer;
- transient delivery failure;
- authentication failure;
- authorization denial;
- incompatible protocol/capability;
- invalid signature/integrity;
- replay/duplicate;
- unknown outcome.

### F10 — Evidence/Provenance Adapter
Every federated accepted artifact MUST retain:
- source identity;
- source domain;
- observed timestamp and semantics;
- artifact/message/event identity;
- trust/authentication evidence;
- local admission decision;
- schema/protocol version;
- cryptographic verification result;
- exact candidate/runtime provenance needed for later reconstruction.

## Typed Failure Contract
Implementation MUST NOT collapse all failures into a boolean or generic exception. At minimum, the public boundary must distinguish:

`AUTHENTICATION_FAILED`
`AUTHORIZATION_DENIED`
`PROTOCOL_INCOMPATIBLE`
`CAPABILITY_INCOMPATIBLE`
`INVALID_SIGNATURE`
`INTEGRITY_FAILED`
`REPLAY_DETECTED`
`DUPLICATE_DELIVERY`
`PEER_UNAVAILABLE`
`TRANSIENT_DELIVERY_FAILURE`
`UNKNOWN_OUTCOME`
`RESOURCE_EXHAUSTED`
`LOCAL_POLICY_REJECTED`
`CONFLICT_REQUIRES_RECONCILIATION`

## State-Machine Rules
Federated processing MUST follow an explicit progression:

`RECEIVE → AUTHENTICATE → PARSE → VERIFY_INTEGRITY → VERIFY_SIGNATURE → CHECK_REPLAY → NEGOTIATED_CAPABILITY_CHECK → LOCAL_ADMISSION → DURABLE_RECORD → EFFECT/RECONCILIATION → COMMIT → VERIFY`

Failure at any stage MUST terminate or transition through a documented recovery path. Later stages must not execute after an earlier mandatory stage fails.

## Security Invariants
1. No unauthenticated peer reaches semantic admission.
2. No invalid signature reaches local admission.
3. No remote trust directly creates local permission.
4. No durable effect is committed twice when idempotency is required.
5. No incompatible capability is silently downgraded.
6. No remote message can mutate immutable local history.
7. Canonical signed bytes are deterministic and versioned.
8. Peer identity, provenance, signature, trust, and authorization remain separate facts.
9. Replay protection is scoped and durable enough for the declared replay window.
10. Retry cannot bypass local admission.
11. Unknown outcome cannot be recorded as success without verified evidence.
12. Resource limits are enforced before expensive work where feasible.

## Resource / Abuse Controls
The first implementation MUST define bounded values for:
- maximum envelope size;
- maximum attachment size;
- maximum concurrent peer sessions;
- maximum outstanding inbox work;
- retry budget/backoff;
- replay-window storage;
- reconciliation batch size;
- per-peer and global rate limits.

The actual selected limits are implementation parameters and require evidence from tests; they are not hardcoded here as universal production values.

## Observability Contract
Every federated processing attempt SHOULD expose correlation data sufficient to join:
- transport session;
- peer identity;
- message identity;
- event/evidence identity;
- admission decision;
- durable inbox record;
- effect/reconciliation result;
- retry/recovery path;
- verification evidence.

Do not claim OpenTelemetry production export until the relevant later-stage implementation is separately verified.

## Implementation Order
1. canonical domain types and error taxonomy;
2. envelope canonicalization and deterministic signing contract;
3. in-memory peer/trust/capability adapters;
4. durable inbox/idempotency integration using existing SIF persistence contracts;
5. local admission adapter boundary;
6. bounded reconciliation engine;
7. transport adapter;
8. fault injection and recovery characterization;
9. CI integration and exact-artifact provenance;
10. promotion review.

No implementation step may silently expand the scope of the prior step.

## Promotion Gates
Phase 3 cannot be promoted from implementation to verified candidate until all applicable rows in `PHASE_3_TEST_MATRIX.md` pass with recorded evidence tied to the exact candidate commit/artifact.

A single passing happy-path test is insufficient. Security-critical failures are not averaged away by unrelated passing tests.

## Release Boundary
- No package version bump is authorized by this contract.
- No registry publication is authorized.
- No merge to `main` is authorized.
- No claim of production federation is authorized.
- Phase 3 remains an unpublished candidate until the full verification gate passes.
