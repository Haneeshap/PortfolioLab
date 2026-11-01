"""Semantic search router: ``GET /api/search/semantic``.

Drop-in replacement for the Java ``AssetSearchController``. Returns a plain
JSON array of ``AssetSearchResult`` objects so the Next.js proxy and MCP
server need zero changes (only BACKEND_URL changes).
"""

import httpx
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import async_session
from app.services.embedding_service import EmbeddingService
from app.services.search_service import SearchService
from app.schemas.search import AssetSearchResult

router = APIRouter()


@router.get(
    "/semantic",
    response_model=list[AssetSearchResult],
    summary="Semantic asset search",
    description=(
        "Embed the query with Ollama (nomic-embed-text, 768 dims), then rank "
        "assets by pgvector cosine similarity. Returns a JSON array."
    ),
)
async def semantic_search(
    q: str = Query(..., min_length=1, description="Search query text."),
    limit: int = Query(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of results to return (1-50).",
    ),
) -> list[AssetSearchResult]:
    query_text = (q or "").strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query must not be blank")

    # Turn the query text into a 768-dim embedding via Ollama.
    embedding_service = EmbeddingService()
    try:
        query_embedding = await embedding_service.embed(query_text)
    except (httpx.HTTPError, ValueError, RuntimeError):
        raise HTTPException(status_code=503, detail="Embedding service unavailable")
    except Exception:  # pragma: no cover - defensive
        raise HTTPException(status_code=503, detail="Embedding service unavailable")

    # Rank assets by cosine similarity against the stored embeddings.
    async with async_session() as session:
        try:
            search_service = SearchService(session)
            results = await search_service.search(query_text, limit, query_embedding)
        except SQLAlchemyError:
            raise HTTPException(status_code=503, detail="Database unavailable")
        except Exception:  # pragma: no cover - defensive
            raise HTTPException(status_code=503, detail="Search service unavailable")

    return results
