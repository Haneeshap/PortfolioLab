"""Pydantic schemas for the semantic search endpoint."""

from pydantic import BaseModel, Field


class AssetSearchResult(BaseModel):
    """Matches the frontend ``AssetSearchResult`` type and the Java record.

    Returned directly as a JSON array so the Next.js proxy and MCP server
    need zero changes (only BACKEND_URL changes).
    """

    assetId: int = Field(..., description="Primary key of the asset.")
    symbol: str = Field(..., description="Asset ticker symbol.")
    name: str = Field(..., description="Human-readable asset name.")
    sector: str | None = Field(None, description="Asset sector, if any.")
    description: str | None = Field(None, description="Asset description, if any.")
    similarity: float = Field(
        ...,
        description="Cosine similarity score (1 - pgvector cosine distance).",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "assetId": 15,
                "symbol": "SOLAR",
                "name": "Solara Renewables",
                "sector": "Energy",
                "description": "Renewable energy and clean technology company.",
                "similarity": 0.92,
            }
        }
    }


class SemanticSearchResponse(BaseModel):
    """Explicit envelope shape documented in the migration task.

    NOTE: the actual running Java backend returns a plain JSON array
    (``List<AssetSearchResult>``), and the frontend consumes it as
    ``AssetSearchResult[]``. To keep the frontend and MCP server at zero
    code change, the endpoint returns a plain JSON array of
    ``AssetSearchResult`` objects, not this envelope. This schema is kept
    for documentation/reference purposes only.
    """

    results: list[AssetSearchResult]
    count: int
