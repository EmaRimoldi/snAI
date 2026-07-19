#!/usr/bin/env bash
# Deploy the RealDoor frontend (+ serverless engine) to production.
#
# The Vercel project's Root Directory is `frontend`, so the deploy runs from
# the REPO ROOT. Before deploying, the Python engine package is copied into
# frontend/api/_engine/ so the Vercel Python function (frontend/api/engine.py)
# can import it — engine/ stays the single source of truth; the copy is
# gitignored and uploaded via the repo-root .vercelignore.
#
# The trailing `vercel alias set` is needed while realdoor-boston.vercel.app
# is still attached to the old "snai" Vercel project (dashboard: move the
# domain to realdoor-boston to drop the alias step).
set -euo pipefail

cd "$(dirname "$0")"

rm -rf api/_engine
mkdir -p api/_engine
cp -r ../engine/realdoor api/_engine/realdoor
cp ../engine/realdoor.config.json api/_engine/realdoor.config.json
find api/_engine -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

cd ..
URL=$(vercel deploy --prod --yes)
vercel alias set "$URL" realdoor-boston.vercel.app
echo "Live: https://realdoor-boston.vercel.app"
