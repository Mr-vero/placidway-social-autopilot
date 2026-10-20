#!/usr/bin/env bash
# Quick look at pipeline state (dev helper).
cd "$(dirname "$0")/.."
docker compose exec -T postgres psql -U pw -d pw -P pager=off -c "select run_id, workflow, trigger, status, left(error,160) err, started_at::time(0), finished_at::time(0) from runs order by id" \
  -c "select id, status, content_type ct, category, attempts, media_path, left(title,50) title from posts order by id" \
  -c "select id, severity, left(message,300) msg from alerts order by id"
