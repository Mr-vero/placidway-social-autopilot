#!/usr/bin/env bash
# One-shot local setup: secrets -> containers -> credentials -> workflows -> activate.
# Safe to re-run (imports overwrite by id).
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\033[1;38;5;209m▸ %s\033[0m\n' "$*"; }

if [ ! -f .env ]; then
  say "Creating .env with fresh secrets"
  cp .env.example .env
  for key in N8N_ENCRYPTION_KEY PW_API_TOKEN LLM_BRIDGE_TOKEN; do
    val=$(openssl rand -hex 24)
    sed -i.bak "s|^${key}=change-me|${key}=${val}|" .env
  done
  rm -f .env.bak
fi
set -a; source .env; set +a

say "Building workflow JSON from source"
node tools/build-workflows.mjs

say "Starting postgres, n8n and the dashboard"
docker compose up -d

say "Waiting for n8n to become healthy"
for i in $(seq 1 60); do
  if curl -fsS http://localhost:5678/healthz >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS http://localhost:5678/healthz >/dev/null || { echo "n8n did not come up: docker compose logs n8n"; exit 1; }

say "Seeding the Postgres credential"
mkdir -p db/seed
cat > db/seed/credentials.json <<JSON
[{
  "id": "pwPostgresCred01",
  "name": "PlacidWay App DB",
  "type": "postgres",
  "data": { "host": "postgres", "port": 5432, "database": "pw", "user": "${POSTGRES_USER:-pw}", "password": "${POSTGRES_PASSWORD:-pw_local_dev}", "ssl": "disable", "allowUnauthorizedCerts": false }
}]
JSON
docker compose exec -T n8n n8n import:credentials --input=/seed/credentials/credentials.json

say "Importing workflows"
docker compose exec -T n8n n8n import:workflow --separate --input=/seed/workflows

say "Activating workflows"
for id in pwErrorHandler01 pwPublishPost001 pwEngagement0001 pwDailyPipeline1 pwDashboardApi01; do
  docker compose exec -T n8n n8n publish:workflow --id="$id" >/dev/null && echo "  published $id"
done
docker compose restart n8n >/dev/null
for i in $(seq 1 60); do curl -fsS http://localhost:5678/healthz >/dev/null 2>&1 && break; sleep 2; done

cat <<EOF

  ✅ Ready.
     Dashboard  → http://localhost:8080
     n8n editor → http://localhost:5678   (first visit: create the local owner account)

  Next: start the LLM bridge in another terminal →  npm run bridge
EOF
