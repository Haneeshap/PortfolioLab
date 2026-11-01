# PortfolioLab Activity Routes
from fastapi import APIRouter, Depends, Query

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session


router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("", summary="List activity feed")
async def list_activity(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_async_session),
):
    """List activity feed items."""
    # Placeholder - would query activity database table
    return [
        {
            "id": 1,
            "type": "order",
            "description": "Order placed: AAPL",
            "timestamp": "2024-01-01T10:00:00Z",
        }
    ]


@router.get("/history", summary="Get activity history")
async def activity_history(
    item_type: str = Query(None, description="Filter by item type"),
    session: AsyncSession = Depends(get_async_session),
):
    """Get activity history."""
    # Placeholder - would query activity history
    return []