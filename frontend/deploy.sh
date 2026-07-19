#!/usr/bin/env bash
# Deploy the RealDoor frontend to production.
#
# The realdoor-boston.vercel.app domain is still attached to the old "snai"
# Vercel project, so a plain `vercel deploy --prod` only reaches the project's
# -mauve alias; the extra `vercel alias set` step points the real domain at the
# new deployment. Once the domain is moved to the realdoor-boston project in
# the Vercel dashboard (Project Settings -> Domains), the alias step becomes a
# no-op and can be removed.
set -euo pipefail

URL=$(vercel deploy --prod --yes)
vercel alias set "$URL" realdoor-boston.vercel.app
echo "Live: https://realdoor-boston.vercel.app"
