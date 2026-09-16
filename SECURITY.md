# Security Boundary

## Current kernel posture

SIF Core 0.5.0 is a development kernel. It treats authority, provenance, integrity and policy as explicit controls, but it is not a complete production security stack.

## Implemented controls

- scoped/expiring authority
- attenuating delegation
- default-deny policy with deny-overrides
- SHA-256 content/event integrity
- Ed25519 attestations
- local federation admission checks
- durable inbox/outbox identity and idempotency primitives
- capability health/verification/authorization gates

## Explicitly outside 0.5.0

- production TLS/mTLS/SPIFFE deployment
- external OPA/Cedar policy engine integration
- KMS/HSM key custody
- distributed consensus and quorum protocol
- production telemetry/exporter security controls
- exactly-once guarantees for arbitrary external side effects

## Reporting

Do not interpret a passing unit or contract test as proof of production security. Security-sensitive integrations require dedicated implementation, threat modeling, adversarial tests, and live verification before promotion.
