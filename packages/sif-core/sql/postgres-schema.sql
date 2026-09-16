-- SIF PostgreSQL schema v0.5.0.
-- The stream-head row is the serialization primitive for concurrent appends.

CREATE TABLE IF NOT EXISTS sif_stream_heads (
  stream_id TEXT PRIMARY KEY,
  stream_version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sif_events (
  stream_id TEXT NOT NULL,
  stream_version BIGINT NOT NULL,
  event_id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  effective_at TIMESTAMPTZ,
  actor_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id UUID,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_digest TEXT NOT NULL,
  previous_digest TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stream_id, stream_version)
);
CREATE INDEX IF NOT EXISTS sif_events_stream_idx ON sif_events(stream_id, stream_version);
CREATE INDEX IF NOT EXISTS sif_events_correlation_idx ON sif_events(correlation_id);

CREATE TABLE IF NOT EXISTS sif_outbox (
  outbox_id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES sif_events(event_id),
  destination TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  delivered_at TIMESTAMPTZ,
  last_error TEXT,
  leased_until TIMESTAMPTZ,
  lease_owner TEXT,
  UNIQUE (event_id, destination)
);
CREATE INDEX IF NOT EXISTS sif_outbox_pending_idx ON sif_outbox(delivered_at, leased_until, created_at);
CREATE INDEX IF NOT EXISTS sif_outbox_claim_idx ON sif_outbox(delivered_at, leased_until, created_at, outbox_id);

CREATE TABLE IF NOT EXISTS sif_inbox (
  message_id UUID NOT NULL,
  consumer_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  result_digest TEXT,
  PRIMARY KEY (consumer_id, message_id)
);
CREATE INDEX IF NOT EXISTS sif_inbox_message_idx ON sif_inbox(message_id, consumer_id);

CREATE TABLE IF NOT EXISTS sif_artifacts (
  digest TEXT PRIMARY KEY,
  media_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT,
  provenance_id TEXT,
  labels JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sif_projection_checkpoints (
  projection_id TEXT NOT NULL,
  stream_id TEXT NOT NULL,
  stream_version BIGINT NOT NULL,
  state_digest TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (projection_id, stream_id)
);
