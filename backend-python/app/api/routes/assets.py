


from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.asset import Asset
from app.schemas.asset import Asset as AssetSchema
from app.schemas.search import AssetSearchResult

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", summary="List assets", response_model=list[AssetSearchResult])
async def list_assets(
    q: str = Query(None, min_length=1, description="Search query"),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_async_session),
):
    """List assets, optionally filtered by search query."""
    stmt = select(Asset).order_by(Asset.symbol.asc()).limit(limit)
    result = await session.execute(stmt)
    assets = result.scalars().all()

    if q:
        # Simple filter by symbol or name containing the query term
        filtered = [
            AssetSearchResult(
                assetId=a.id,
                symbol=a.symbol,
                name=a.name,
                sector=a.sector,
                description=a.description,
                similarity=1.0,
            )
            for a in assets
            if q.lower() in a.symbol.lower() or q.lower() in a.name.lower()
        ]
        return filtered


@router.get("/{asset_id}", summary="Get asset by ID", response_model=AssetSchema)
async def get_asset(
    asset_id: int,
    session: AsyncSession = Depends(get_async_session),
):
    """Get asset by ID."""
    stmt = select(Asset).where(Asset.id == asset_id)
    result = await session.execute(stmt)
    asset = result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return AssetSchema(
        id=asset.id,
        symbol=asset.symbol,
        name=asset.name,
        price=asset.price,
        currency=asset.currency,
        sector=asset.sector,
        description=asset.description,
    )
