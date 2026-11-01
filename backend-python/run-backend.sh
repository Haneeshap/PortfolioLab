#!/usr/bin/env bash
# PortfolioLab Python backend - drop-in replacement for the Java Spring Boot backend
set -euo pipefail

export DB_PASSWORD="${DB_PASSWORD:-PortfolioLabLocalDev2026}"

if [ "${#DB_PASSWORD}" -lt 16 ]; then
    echo "ERROR: DB_PASSWORD must be at least 16 characters long." >&2
    exit 1
fi

cd "$(dirname "$0")"

uvicorn app.main:app --reload --port 8000
