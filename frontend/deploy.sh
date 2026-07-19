#!/usr/bin/env bash
# Deploy the RealDoor frontend (+ serverless engine) to production.
#
# The Vercel project's Root Directory is `frontend`, so the deploy runs from
# the REPO ROOT. Before deploying, the Python engine package is copied into
# frontend/api/_engine/ so the Vercel Python function (frontend/api/engine.py)
# can import it — engine/ stays the single source of truth; the copy is
# gitignored and uploaded via the repo-root .vercelignore.
#
# realdoor-boston.vercel.app is a domain of the realdoor-boston project itself
# (moved from the old "snai" project on 2026-07-19), so production deploys go
# live on it automatically — no alias step needed.
set -euo pipefail

cd "$(dirname "$0")"

rm -rf api/_engine
mkdir -p api/_engine
cp -r ../engine/realdoor api/_engine/realdoor
cp ../engine/realdoor.config.json api/_engine/realdoor.config.json
find api/_engine -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

cd ..
vercel deploy --prod --yes
echo "Live: https://realdoor-boston.vercel.app"
