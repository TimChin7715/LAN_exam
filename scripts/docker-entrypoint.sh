#!/bin/sh
set -e
cd /app

pnpm exec prisma migrate deploy

admin_mode="$(echo "${ADMIN_AUTH_MODE:-disabled}" | tr '[:upper:]' '[:lower:]')"
if [ "$admin_mode" = "disabled" ]; then
  pnpm exec prisma db seed
else
  if [ -z "$SEED_ADMIN_PASSWORD" ]; then
    echo "FATAL: SEED_ADMIN_PASSWORD is not set (required when ADMIN_AUTH_MODE=session)" >&2
    exit 1
  fi
  pnpm exec prisma db seed
fi

exec node apps/server/dist/index.js
