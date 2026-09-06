#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres cluster and runs the schema
# assertions in supabase/test. Catches broken SQL before it reaches a project.
set -euo pipefail

# Postgres refuses to run as root. Re-exec as an unprivileged user when needed
# (CI containers commonly run as root).
if [ "$(id -u)" = "0" ]; then
  RUN_AS="${PG_RUN_AS:-postgres}"
  if ! id "$RUN_AS" >/dev/null 2>&1; then
    RUN_AS=ubuntu
  fi
  if ! id "$RUN_AS" >/dev/null 2>&1; then
    useradd -m "$RUN_AS"
  fi
  SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
  ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
  # The unprivileged user needs to read the repository.
  chmod -R a+rX "$ROOT_DIR/supabase" "$ROOT_DIR/scripts"
  exec su "$RUN_AS" -c "PGBIN='${PGBIN:-/usr/lib/postgresql/17/bin}' PATH='$PATH' bash '$SELF'"
fi

PGBIN="${PGBIN:-/usr/lib/postgresql/17/bin}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKDIR="$(mktemp -d)"
PGDATA="$WORKDIR/pgdata"
SOCKET="$WORKDIR/socket"
DBNAME=lingonest_test

cleanup() {
  "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

mkdir -p "$SOCKET"
"$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$PGDATA" -o "-k $SOCKET -c listen_addresses=''" -l "$WORKDIR/pg.log" start >/dev/null
"$PGBIN/createdb" -h "$SOCKET" -U postgres "$DBNAME"

psql_run() { psql -h "$SOCKET" -U postgres -d "$DBNAME" -v ON_ERROR_STOP=1 -q "$@"; }

echo "→ bootstrapping Supabase stand-ins"
psql_run -f "$ROOT/supabase/test/bootstrap_supabase_stub.sql"

echo "→ applying migrations"
for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$file")"
  psql_run -f "$file"
done

echo "→ running schema assertions"
psql_run -f "$ROOT/supabase/test/schema_assertions.sql"

echo "✓ migrations apply cleanly"
