# REIE PostgreSQL Adapter 1.0.0

This is the optional PostgreSQL persistence boundary for REIE. The dependency-free local runtime remains usable without a database.

The adapter persists:
- sources with content digests
- entities with deterministic canonical keys and collision protection
- claims with entity/source foreign keys and JSONB values
- deterministic knowledge queries and evidence-aware evaluation

Entity upserts are transaction-protected. Concurrent writers are protected by the database unique canonical-key constraint; exactly one identity may claim a canonical key.

The package uses node-postgres 8.23.0 and @types/pg 8.23.1. These are MIT-licensed public packages. PostgreSQL itself remains an external runtime requirement; the adapter does not provision a managed database.
