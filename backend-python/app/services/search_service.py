"""Vector similarity search service.

Port of the Java ``AssetSearchRepository.searchNearest`` query:

    SELECT a.id AS asset_id, a.symbol, a.name, a.sector, a.description,
           1 - (e.embedding <=> CAST(? AS vector(768))) AS similarity
    FROM asset_search_embeddings e
    JOIN assets a ON a.id = e.asset_id
    ORDER BY e.embedding <=> CAST(? AS vector(768)) ASC
    LIMIT ?

Similarity is reported as ``1 - cosine_distance`` so the highest-similarity
assets sort first (cosine distance ascending == similarity descending).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.asset_search_embedding import AssetSearchEmbedding
from app.schemas.search import AssetSearchResult


class SearchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def search(
        self, query: str, limit: int, query_embedding: list[float]
    ) -> list[AssetSearchResult]:
        """Return the ``limit`` nearest assets to ``query_embedding``.

        ``query`` is retained for logging/debugging; the ranking is driven by
        the pre-computed query embedding.
        """
        distance_expr = AssetSearchEmbedding.embedding.cosine_distance(query_embedding)
        similarity_expr = (1 - distance_expr).label("similarity")

        stmt = (
            select(Asset, similarity_expr)
            .join(
                AssetSearchEmbedding,
                Asset.id == AssetSearchEmbedding.asset_id,
            )
            .order_by(distance_expr.asc())
            .limit(limit)
        )

        result = await self.session.execute(stmt)
        rows = result.all()

        return [
            AssetSearchResult(
                assetId=asset.id,
                symbol=asset.symbol,
                name=asset.name,
                sector=asset.sector,
                description=asset.description,
                similarity=float(similarity),
            )
            for asset, similarity in rows
        ]
