#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/../.."

version="$(cat VERSION 2>/dev/null || echo latest)"
tag="lan-exam:${version}"

echo "Building ${tag} and lan-exam:latest ..."
docker build -t "${tag}" -t lan-exam:latest .

echo "Done. Run: docker compose up -d"
echo "  or: docker run --rm -p 5180:5180 ... (see docs/DEPLOY-DOCKER.md)"
