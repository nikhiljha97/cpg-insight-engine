#!/usr/bin/env bash
# Starts API + Vite preview, runs Playwright, then tears down. No manual steps.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

npm run build

(lsof -ti:4000 | xargs kill -9 2>/dev/null) || true
(lsof -ti:4173 | xargs kill -9 2>/dev/null) || true

PORT=4000 npx tsx server/index.ts &
PID_API=$!
PID_UI=""

cleanup() {
  if [[ -n "$PID_UI" ]] && kill -0 "$PID_UI" 2>/dev/null; then kill "$PID_UI" 2>/dev/null || true; fi
  if kill -0 "$PID_API" 2>/dev/null; then kill "$PID_API" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

API_UP=0
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:4000/api/cities" >/dev/null; then API_UP=1; break; fi
  sleep 1
done
[[ "$API_UP" == 1 ]] || { echo "e2e: API did not become ready on :4000"; exit 1; }

npx vite preview --host 127.0.0.1 --port 4173 --strictPort &
PID_UI=$!

UI_UP=0
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:4173/" >/dev/null; then UI_UP=1; break; fi
  sleep 1
done
[[ "$UI_UP" == 1 ]] || { echo "e2e: Vite preview did not become ready on :4173"; exit 1; }

export CI="${CI:-}"
echo "e2e: starting Playwright — $*"
npx playwright test "$@"
