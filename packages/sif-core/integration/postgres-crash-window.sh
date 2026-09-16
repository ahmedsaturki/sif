#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=postgres}"

psql_base=(psql -v ON_ERROR_STOP=1 -X -A -t -q)
psql_query() {
  "${psql_base[@]}" -c "$1"
}

new_uuid() {
  node -e "console.log(require('node:crypto').randomUUID())"
}

wait_for_backend_pid() {
  local log_file="$1"
  for _ in $(seq 1 30); do
    if [[ -s "$log_file" ]]; then
      local pid
      pid="$(grep -m1 -E '^[0-9]+$' "$log_file" || true)"
      if [[ -n "$pid" ]]; then
        printf '%s\n' "$pid"
        return 0
      fi
    fi
    sleep 1
  done
  echo "Timed out waiting for PostgreSQL backend PID in $log_file" >&2
  return 1
}

cleanup_stream() {
  local stream_id="$1"
  psql_query "DELETE FROM sif_outbox WHERE event_id IN (SELECT event_id FROM sif_events WHERE stream_id='${stream_id}'); DELETE FROM sif_events WHERE stream_id='${stream_id}'; DELETE FROM sif_stream_heads WHERE stream_id='${stream_id}';" >/dev/null || true
}


echo 'before-commit crash window'
STREAM_BEFORE="$(new_uuid)"
EVENT_BEFORE="$(new_uuid)"
PID_FILE_BEFORE="$(mktemp)"
TX_LOG_BEFORE="$(mktemp)"
cleanup_stream "$STREAM_BEFORE"
trap 'rm -f "$PID_FILE_BEFORE" "$TX_LOG_BEFORE"' EXIT

psql -v ON_ERROR_STOP=1 -X -A -t -q >"$TX_LOG_BEFORE" 2>&1 <<SQL &
BEGIN;
SELECT pg_backend_pid();
INSERT INTO sif_stream_heads (stream_id, stream_version) VALUES ('$STREAM_BEFORE', 0);
INSERT INTO sif_events (stream_id, stream_version, event_id, event_type, occurred_at, observed_at, effective_at, actor_id, correlation_id, causation_id, payload, metadata, event_digest, previous_digest)
VALUES ('$STREAM_BEFORE', 1, '$EVENT_BEFORE', 'crash.before.commit', now(), now(), NULL, 'integration-test', '$EVENT_BEFORE', NULL, '{}'::jsonb, '{}'::jsonb, repeat('a', 64), NULL);
UPDATE sif_stream_heads SET stream_version = 1, updated_at = now() WHERE stream_id = '$STREAM_BEFORE';
SELECT pg_sleep(60);
COMMIT;
SQL
TX_PID_BEFORE=$!
printf '%s\n' "$TX_PID_BEFORE" >"$PID_FILE_BEFORE"
BACKEND_BEFORE="$(wait_for_backend_pid "$TX_LOG_BEFORE")"
psql_query "SELECT pg_terminate_backend($BACKEND_BEFORE);" >/dev/null
wait "$TX_PID_BEFORE" || true

BEFORE_STATE="$(psql_query "SELECT (SELECT count(*) FROM sif_events WHERE stream_id='$STREAM_BEFORE'), (SELECT count(*) FROM sif_stream_heads WHERE stream_id='$STREAM_BEFORE'), (SELECT count(*) FROM sif_outbox o JOIN sif_events e ON e.event_id=o.event_id WHERE e.stream_id='$STREAM_BEFORE')")"
if [[ "$BEFORE_STATE" != '0|0|0' ]]; then
  echo "before-commit crash window left partial state: $BEFORE_STATE" >&2
  exit 1
fi

# Retry after the aborted transaction: the same stream must be writable again.
psql_query "INSERT INTO sif_stream_heads (stream_id, stream_version) VALUES ('$STREAM_BEFORE', 0);" >/dev/null
RETRY_STATE="$(psql_query "SELECT stream_version FROM sif_stream_heads WHERE stream_id='$STREAM_BEFORE'")"
[[ "$RETRY_STATE" == '0' ]] || { echo "retry admission failed: $RETRY_STATE" >&2; exit 1; }
cleanup_stream "$STREAM_BEFORE"
trap - EXIT
rm -f "$PID_FILE_BEFORE" "$TX_LOG_BEFORE"


echo 'after-commit before-acknowledgement window'
STREAM_AFTER="$(new_uuid)"
EVENT_AFTER="$(new_uuid)"
PID_FILE_AFTER="$(mktemp)"
TX_LOG_AFTER="$(mktemp)"
cleanup_stream "$STREAM_AFTER"
trap 'rm -f "$PID_FILE_AFTER" "$TX_LOG_AFTER"' EXIT

psql -v ON_ERROR_STOP=1 -X -A -t -q >"$TX_LOG_AFTER" 2>&1 <<SQL &
BEGIN;
INSERT INTO sif_stream_heads (stream_id, stream_version) VALUES ('$STREAM_AFTER', 0);
INSERT INTO sif_events (stream_id, stream_version, event_id, event_type, occurred_at, observed_at, effective_at, actor_id, correlation_id, causation_id, payload, metadata, event_digest, previous_digest)
VALUES ('$STREAM_AFTER', 1, '$EVENT_AFTER', 'crash.after.commit', now(), now(), NULL, 'integration-test', '$EVENT_AFTER', NULL, '{}'::jsonb, '{}'::jsonb, repeat('b', 64), NULL);
UPDATE sif_stream_heads SET stream_version = 1, updated_at = now() WHERE stream_id = '$STREAM_AFTER';
COMMIT;
SELECT pg_backend_pid();
SELECT pg_sleep(60);
SQL
TX_PID_AFTER=$!
printf '%s\n' "$TX_PID_AFTER" >"$PID_FILE_AFTER"
BACKEND_AFTER="$(wait_for_backend_pid "$TX_LOG_AFTER")"
psql_query "SELECT pg_terminate_backend($BACKEND_AFTER);" >/dev/null
wait "$TX_PID_AFTER" || true

AFTER_STATE="$(psql_query "SELECT (SELECT stream_version FROM sif_stream_heads WHERE stream_id='$STREAM_AFTER'), (SELECT count(*) FROM sif_events WHERE stream_id='$STREAM_AFTER'), (SELECT count(*) FROM sif_outbox o JOIN sif_events e ON e.event_id=o.event_id WHERE e.stream_id='$STREAM_AFTER')")"
if [[ "$AFTER_STATE" != '1|1|0' ]]; then
  echo "after-commit window lost committed state: $AFTER_STATE" >&2
  exit 1
fi
cleanup_stream "$STREAM_AFTER"
trap - EXIT
rm -f "$PID_FILE_AFTER" "$TX_LOG_AFTER"

echo 'PASS: PostgreSQL before-commit termination rolls back; after-commit client termination preserves committed state.'
