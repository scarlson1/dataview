#!/usr/bin/env bash
# Run the pgTAP test suite against the local Supabase database.
#
# Preferred:   supabase test db          (uses the CLI; installs pgTAP for you)
# This script: a fallback for when the Supabase CLI is not installed. It pipes
# each *_test.sql file straight into the running local Postgres container via
# psql. Every file wraps itself in BEGIN/ROLLBACK, so nothing is persisted.
#
# Usage:  supabase/tests/run.sh [container_name]
set -euo pipefail

CONTAINER="${1:-supabase_db_evertas}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "error: container '$CONTAINER' is not running (start it with 'supabase start')" >&2
  exit 1
fi

status=0
for f in "$DIR"/*_test.sql; do
  [ -e "$f" ] || continue
  echo "==> $(basename "$f")"
  # -q keeps psql quiet; the TAP stream from pgTAP is what we care about.
  out="$(docker exec -i "$CONTAINER" psql -q -U postgres -d postgres -f - < "$f" 2>&1)"
  # Surface the TAP lines and the summary; flag any failures.
  echo "$out" | grep -E '^( *(not )?ok [0-9]|# )' || true
  if echo "$out" | grep -qE '^ *not ok |ERROR:'; then
    echo "FAILED: $(basename "$f")" >&2
    status=1
  fi
done

exit $status
