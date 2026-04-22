#!/usr/bin/env bash
# Starts API + Vite preview, runs Playwright, then tears down. No manual steps.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

# Defaults mirror `src/constants/appDefaults.ts` (API_DEFAULT_PORT, E2E_PREVIEW_PORT).
E2E_API_PORT="${E2E_API_PORT:-4000}"
E2E_UI_PORT="${E2E_UI_PORT:-4173}"

npm run build

(lsof -ti:"$E2E_API_PORT" | xargs kill -9 2>/dev/null) || true
(lsof -ti:"$E2E_UI_PORT" | xargs kill -9 2>/dev/null) || true

PORT="$E2E_API_PORT" npx tsx server/index.ts &
PID_API=$!
PID_UI=""

cleanup() {
  if [[ -n "$PID_UI" ]] && kill -0 "$PID_UI" 2>/dev/null; then kill "$PID_UI" 2>/dev/null || true; fi
  if kill -0 "$PID_API" 2>/dev/null; then kill "$PID_API" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

API_UP=0
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:${E2E_API_PORT}/api/cities" >/dev/null; then API_UP=1; break; fi
  sleep 1
done
[[ "$API_UP" == 1 ]] || { echo "e2e: API did not become ready on :${E2E_API_PORT}"; exit 1; }

npx vite preview --host 127.0.0.1 --port "$E2E_UI_PORT" --strictPort &
PID_UI=$!

UI_UP=0
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:${E2E_UI_PORT}/" >/dev/null; then UI_UP=1; break; fi
  sleep 1
done
[[ "$UI_UP" == 1 ]] || { echo "e2e: Vite preview did not become ready on :${E2E_UI_PORT}"; exit 1; }

export CI="${CI:-}"
echo "e2e: starting Playwright — $*"
npx playwright test "$@"
