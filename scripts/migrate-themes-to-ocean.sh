#!/usr/bin/env bash
# Migrate all user themePreference values → ocean (Ocean Blue only).
# Reads DB_* from `.env` (NODE_ENV) + `.env.local` / `.env.dev`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — set NODE_ENV=local or NODE_ENV=dev"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source <(grep -E '^(NODE_ENV)=' .env | sed 's/\r$//' || true)
ENV_NAME="${NODE_ENV:-local}"
ENV_FILE=".env.${ENV_NAME}"
if [[ "$ENV_NAME" == "development" ]]; then ENV_FILE=".env.dev"; fi
if [[ "$ENV_NAME" == "production" ]]; then ENV_FILE=".env.prod"; fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"
  exit 1
fi
# shellcheck disable=SC1091
source <(grep -E '^(DB_HOST|DB_PORT|DB_USERNAME|DB_PASSWORD|DB_DATABASE)=' "$ENV_FILE" | sed 's/\r$//')
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
