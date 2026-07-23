#!/usr/bin/env bash
# Sets the real password on the exec_board_app role (see the tenancy_rls
# migration) from .env. Safe to re-run — idempotent. Never put the real
# password in a tracked migration file.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
source .env
set +a

: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is not set in .env}"

docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE exec_board_app WITH PASSWORD '${APP_DB_PASSWORD}';"

echo "exec_board_app password synced from .env"
