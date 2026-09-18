CREATE TABLE IF NOT EXISTS reie_sources (
  source_id TEXT PRIMARY KEY,
  uri TEXT,
  title TEXT,
  publisher TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  content_digest TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reie_entities (
  entity_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  location TEXT,
  canonical_key TEXT NOT NULL UNIQUE,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS reie_claims (
  claim_id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES reie_entities(entity_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES reie_sources(source_id) ON DELETE RESTRICT,
  field TEXT NOT NULL,
  value JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS reie_claims_entity_idx ON reie_claims(entity_id, field, observed_at);
CREATE INDEX IF NOT EXISTS reie_claims_source_idx ON reie_claims(source_id, observed_at);
