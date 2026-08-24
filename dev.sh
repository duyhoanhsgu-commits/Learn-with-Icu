#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
SKIP_DOCKER="${SKIP_DOCKER:-0}"

BACKEND_PID=""
FRONTEND_PID=""
CLEANED_UP=0

cleanup() {
  if [[ "$CLEANED_UP" -eq 1 ]]; then
    return
  fi

  CLEANED_UP=1
  trap - INT TERM EXIT

  printf '\nStopping frontend and backend...\n'

  if [[ -n "$FRONTEND_PID" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi

  if [[ -n "$BACKEND_PID" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  wait "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

command -v python3 >/dev/null 2>&1 || {
  echo "Error: python3 is not installed."
  exit 1
}

command -v npm >/dev/null 2>&1 || {
  echo "Error: npm is not installed."
  exit 1
}

cd "$PROJECT_DIR"

if [[ "$SKIP_DOCKER" != "1" ]]; then
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "Starting PostgreSQL and Qdrant..."
    docker compose up -d postgres qdrant
  else
    echo "Warning: Docker Compose is unavailable; PostgreSQL and Qdrant were not started."
  fi
fi

if [[ ! -x "$PROJECT_DIR/.venv/bin/python" ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$PROJECT_DIR/.venv"
fi

if ! "$PROJECT_DIR/.venv/bin/python" -c "import uvicorn, fastapi" >/dev/null 2>&1; then
  echo "Installing backend dependencies..."
  "$PROJECT_DIR/.venv/bin/python" -m pip install -e "$PROJECT_DIR"
fi

if [[ ! -x "$PROJECT_DIR/frontend/node_modules/.bin/vite" ]]; then
  echo "Installing frontend dependencies..."
  npm install --prefix "$PROJECT_DIR/frontend"
fi

echo "Starting backend at http://localhost:${BACKEND_PORT}"
(
  cd "$PROJECT_DIR"
  PYTHONPATH="$PROJECT_DIR/backend" exec "$PROJECT_DIR/.venv/bin/python" -m uvicorn \
    src.api.main:app \
    --reload \
    --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

echo "Starting frontend at http://localhost:${FRONTEND_PORT}"
(
  cd "$PROJECT_DIR/frontend"
  exec "$PROJECT_DIR/frontend/node_modules/.bin/vite" \
    --host 0.0.0.0 \
    --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

printf '\nApp is running. Press Ctrl+C to stop frontend and backend.\n\n'

set +e
wait -n "$BACKEND_PID" "$FRONTEND_PID"
EXIT_CODE=$?
set -e

echo "A development process stopped (exit code: $EXIT_CODE)."
cleanup
exit "$EXIT_CODE"
