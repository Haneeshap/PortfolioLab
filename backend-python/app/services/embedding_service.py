"""Embedding service ported from Java ``OllamaEmbeddingClient``.

Calls the Ollama ``/api/embeddings`` endpoint (the same endpoint used by the
Java client) for the ``nomic-embed-text`` model and hardens the result:
validates that the returned vector dimension is exactly 768, raising
``ValueError`` otherwise.

``parse_embedding`` is a standalone function so it can be unit tested
independently of the HTTP client.
"""

from typing import Any

import httpx

from app.core.config import settings

EMBEDDING_MODEL = settings.OLLAMA_MODEL
EMBEDDING_DIMENSION = settings.EMBEDDING_DIMENSION
OLLAMA_EMBED_URL = settings.ollama_embed_url


def parse_embedding(body: Any) -> list[float]:
    """Parse the Ollama embeddings response body into a list of floats.

    Independently testable: pass a parsed JSON object and get back the
    embedding vector. Raises ``ValueError`` if the ``embedding`` array is
    missing, is not a list, or contains non-numeric values.
    """
    if not isinstance(body, dict):
        raise ValueError("Ollama embeddings response is not a JSON object")
    embedding = body.get("embedding")
    if embedding is None or not isinstance(embedding, list):
        raise ValueError("Ollama embeddings response missing embedding array")
    try:
        return [float(value) for value in embedding]
    except (TypeError, ValueError) as exc:
        raise ValueError(
            "Ollama embeddings response contains non-numeric values"
        ) from exc


class EmbeddingService:
    def __init__(self) -> None:
        self.model = EMBEDDING_MODEL
        self.dimension = EMBEDDING_DIMENSION
        self.embed_url = OLLAMA_EMBED_URL

    async def embed(self, text: str) -> list[float]:
        """Embed ``text`` using Ollama and validate the dimension.

        Raises:
            ValueError: if the returned vector length != EMBEDDING_DIMENSION.
            httpx.HTTPError: if Ollama is unreachable or returns an error.
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.embed_url,
                json={"model": self.model, "prompt": text},
                headers={"Content-Type": "application/json"},
            )
        if response.status_code < 200 or response.status_code >= 300:
            raise RuntimeError(
                f"Ollama embeddings returned HTTP {response.status_code}"
            )
        body = response.json()
        vector = parse_embedding(body)
        if len(vector) != self.dimension:
            raise ValueError(
                f"Expected {self.dimension} embedding dimensions, got {len(vector)}"
            )
        return vector
