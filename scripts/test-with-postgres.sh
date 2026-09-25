#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found — skip Postgres integration (unit tests only)"
  exit 0
fi

if [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${POSTGRES_APP_PASSWORD:-}" ]; then
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-integration-postgres-superuser}"
  POSTGRES_APP_PASSWORD="${POSTGRES_APP_PASSWORD:-integration-app-password}"
  export POSTGRES_PASSWORD POSTGRES_APP_PASSWORD
fi

docker compose up -d db
echo "Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U second_brain -d second_brain >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

export DATABASE_URL="postgres://second_brain:${POSTGRES_APP_PASSWORD}@127.0.0.1:5432/second_brain"
export RUN_PG_INTEGRATION=1
export AUTH_PASSWORD_HASH="${AUTH_PASSWORD_HASH:-}"
export SESSION_SECRET="${SESSION_SECRET:-integration-test-secret-at-least-32-chars}"

if [ -z "$AUTH_PASSWORD_HASH" ]; then
  AUTH_PASSWORD_HASH="$(node -e "const {hash,argon2id}=require('argon2'); hash('integration-password',{type:argon2id,memoryCost:4096,timeCost:1,parallelism:1}).then(h=>process.stdout.write(h))")"
  export AUTH_PASSWORD_HASH
fi

npm test
docker compose stop db
