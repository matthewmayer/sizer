#!/usr/bin/env bash

set -euo pipefail

PORT=8652

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  echo "Python is not installed or not on PATH." >&2
  exit 1
fi

echo "Serving $(pwd) at http://localhost:${PORT}"
exec "$PYTHON" -m http.server "${PORT}"

