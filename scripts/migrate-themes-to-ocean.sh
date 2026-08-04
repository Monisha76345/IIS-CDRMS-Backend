#!/usr/bin/env bash
# Migrate all user themePreference values → ocean (Ocean Blue only).
# Reads DB_* from `.env` only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source <(grep -E '^(DB_HOST|DB_PORT|DB_USERNAME|DB_PASSWORD|DB_DATABASE)=' .env | sed 's/\r$//')
set +a

: "${DB_HOST:?Missing DB_HOST}"
: "${DB_PORT:?Missing DB_PORT}"
: "${DB_USERNAME:?Missing DB_USERNAME}"
: "${DB_PASSWORD:?Missing DB_PASSWORD}"
: "${DB_DATABASE:?Missing DB_DATABASE}"

SQL_FILE="$ROOT/scripts/migrate-themes-to-ocean.sql"
echo "Updating themePreference → ocean on ${DB_DATABASE}@${DB_HOST}:${DB_PORT} …"

mysql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USERNAME" \
  --password="$DB_PASSWORD" \
  "$DB_DATABASE" < "$SQL_FILE"

echo "Done."
