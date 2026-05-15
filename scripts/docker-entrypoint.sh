#!/bin/sh
set -e
cd /app

if [ -z "$SEED_ADMIN_PASSWORD" ]; then
  echo "FATAL: SEED_ADMIN_PASSWORD is not set (required for prisma db seed on first deploy)" >&2
  exit 1
fi

pnpm exec prisma migrate deploy
pnpm exec prisma db seed

exec node apps/server/dist/index.js
