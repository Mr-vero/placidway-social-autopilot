#!/usr/bin/env bash
# Rebuild workflow JSON from source, re-import into the running n8n, re-activate.
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/build-workflows.mjs >/dev/null
docker compose exec -T n8n n8n import:workflow --separate --input=/seed/workflows 2>&1 | grep -E "imported|rror"
for id in pwErrorHandler01 pwPublishPost001 pwEngagement0001 pwDailyPipeline1 pwDashboardApi01; do
  docker compose exec -T n8n n8n publish:workflow --id="$id" >/dev/null
done
docker compose restart n8n >/dev/null
for i in $(seq 1 60); do curl -fsS http://localhost:5678/healthz >/dev/null 2>&1 && break; sleep 2; done
echo "reimported + active"
