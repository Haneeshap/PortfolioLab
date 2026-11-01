# PortfolioLab Backend (Python FastAPI)

Drop-in replacement for the Java Spring Boot backend (`/backend`). It exposes
the exact same semantic search endpoint so the Next.js frontend and the
MCP server need **zero code changes** — only `BACKEND_URL` changes.

## Endpoint

```
GET /api/search/semantic?q={query}&limit={N}
```

Returns a JSON array of `AssetSearchResult` objects
(`assetId`, `symbol`, `name`, `sector`, `description`, `similarity`) —
identical in shape to the current Java `List<AssetSearchResult>` response.

## Requirements

- Python 3.11+
- PostgreSQL + pgvector (same database as the Java backend), running on
  `localhost:5432`, database `portfoliolab`, user `portfoliolab`
- Ollama running on `http://127.0.0.1:11434` with `nomic-embed-text` (768 dims)

## Setup

```powershell
# From backend-python/
pip install -r requirements.txt

# Copy the example env and set DB_PASSWORD to match your Postgres password
copy .env.example .env   # PowerShell
# or
cp .env.example .env     # bash / git bash

# Edit .env and set DB_PASSWORD (must match the Docker Compose password,
# e.g. PortfolioLabLocalDev2026)
```

## Run

```powershell
# Apply Alembic migrations (idempotent if the Flyway-migrated tables already exist)
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --port 8000
```

Or use the convenience scripts (they set `DB_PASSWORD` and launch uvicorn):

```powershell
.\run-backend.bat        # PowerShell / CMD
./run-backend.sh         # bash / git bash
```

The API will be available at `http://127.0.0.1:8000`.

## Test

```powershell
curl "http://127.0.0.1:8000/api/search/semantic?q=renewable+energy&limit=5"
# Expected (same ranking as the Java backend): SOLAR, GREEN, VOLT (Energy sector)
```

## Environment variables

| Variable | Example | Notes |
|---|---|---|
| `DB_PASSWORD` | `PortfolioLabLocalDev2026` | Postgres password (critical) |
| `DATABASE_URL` | `postgresql+asyncpg://...` | Optional; built from parts if omitted |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | Postgres host/port |
| `DB_USER` / `DB_NAME` | `portfoliolab` / `portfoliolab` | Postgres user/database |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama server |
| `OLLAMA_MODEL` | `nomic-embed-text` | Embedding model |
| `EMBEDDING_DIMENSION` | `768` | Validated on every embedding |
| `BACKEND_URL` | `http://127.0.0.1:8000` | Advertised backend URL |
| `BACKEND_PORT` | `8000` | uvicorn port |

## Notes

- Reuses the same PostgreSQL + pgvector database as the Java backend. No new
  database is created.
- SQLAlchemy 2.0 async + asyncpg; Alembic manages migrations (`alembic/`).
- The Alembic migration `0001_asset_vector_search` ports Flyway
  `V24__asset_vector_search.sql` (pgvector extension, `asset_search_embeddings`
  table, HNSW cosine index) and is idempotent if those objects already exist.
- Ollama embedding dimension is validated to be exactly 768; a mismatch raises
  `ValueError` and the endpoint responds `503`.
- DB or Ollama unreachable → `503` (same behavior the Next.js proxy expects).
