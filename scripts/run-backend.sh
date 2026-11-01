#!/usr/bin/env bash
# PortfolioLab Python backend launcher with DB_PASSWORD validation.
set -euo pipefail

export DB_PASSWORD="${DB_PASSWORD:-}"

if [ "${#DB_PASSWORD}" -lt 16 ]; then
    echo "ERROR: DB_PASSWORD must be at least 16 characters long." >&2
    exit 1
fi

cd "$(dirname "$0")/../backend-python"

uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"