#!/usr/bin/env bash
set -Eeuo pipefail
image=${1:?Usage: docker-smoke.sh IMAGE}
prefix="sky-web-smoke-${GITHUB_RUN_ID:-local}-${RANDOM}"
root_dir=$(cd "$(dirname "$0")/.." && pwd)
payload=$(mktemp)
cleanup() {
  result=$?
  trap - EXIT
  if [[ $result -ne 0 ]]; then docker logs "$prefix-web" || true; fi
  docker rm -f "$prefix-web" "$prefix-backend" "$prefix-reservation" >/dev/null 2>&1 || true
  docker network rm "$prefix" >/dev/null 2>&1 || true
  rm -f "$payload"
  exit "$result"
}
trap cleanup EXIT
docker network create "$prefix" >/dev/null
start_backend() {
  docker run -d --name "$prefix-backend" --network "$prefix" --network-alias backend \
    -e "MARKER=$1" \
    --mount "type=bind,src=$root_dir/deploy/smoke-backend.py,dst=/smoke.py,readonly" \
    python:3.12-alpine python /smoke.py >/dev/null
}
start_backend first
docker run --rm --entrypoint nginx "$image" -v
docker run -d --name "$prefix-web" --network "$prefix" -p 127.0.0.1::80 "$image" >/dev/null
port=$(docker port "$prefix-web" 80/tcp | head -n 1 | awk -F: '{print $NF}')
base="http://127.0.0.1:$port"
curl --retry 30 --retry-connrefused --retry-delay 1 --fail "$base/healthz"
curl --fail "$base/" | grep -q '<div id="app">'
curl --fail "$base/jobs/123" | grep -q '<div id="app">'
curl --retry 30 --retry-all-errors --retry-delay 1 --fail "$base/api/check?keep=1" | grep -q 'first /api/check?keep=1'
head -c 2097152 /dev/zero > "$payload"
curl --fail --data-binary "@$payload" "$base/api/upload" | grep -q 'first /api/upload'
# Force the replacement onto a different IP to verify DNS refresh, not just reconnect.
old_ip=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$prefix-backend")
docker rm -f "$prefix-backend" >/dev/null
docker run -d --name "$prefix-reservation" --network "$prefix" --ip "$old_ip" \
  python:3.12-alpine python -c 'import time; time.sleep(180)' >/dev/null
start_backend second
matched=false
for attempt in {1..30}; do
  if curl --silent --fail "$base/api/check" | grep -q 'second /api/check'; then
    matched=true; break
  fi
  sleep 1
done
[[ "$matched" == true ]]
echo 'Nginx smoke test passed.'
