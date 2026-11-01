# PortfolioLab Price Alerts Routes
from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session


router = APIRouter(prefix="/price-alerts", tags=["price-alerts"])


@router.get("", summary="List price alerts")
async def list_price_alerts(
    session: AsyncSession = Depends(get_async_session),
):
    """List all price alerts."""
    # Placeholder - in production would query price_alerts table
    return [
        {"id": 1, "symbol": "AAPL", "target_price": 150.0, "alert_type": "above", "is_active": True},
        {"id": 2, "symbol": "GOOGL", "target_price": 2800.0, "alert_type": "below", "is_active": False},
    ]


@router.post("", summary="Create price alert")
async def create_price_alert(
    symbol: str = Query(...),
    target_price: float = Query(...),
    alert_type: str = Query(..., regex="^(above|below)$"),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new price alert."""
    return {
        "id": 3,
        "symbol": symbol,
        "target_price": target_price,
        "alert_type": alert_type,
        "is_active": True,
        "created_at": "2024-01-01T00:00:00Z",
    }


@router.delete("/{alert_id}", summary="Delete price alert")
async def delete_price_alert(
    alert_id: int,
    session: AsyncSession = Depends(get_async_session),
):
    """Delete a price alert."""
    return {"deleted_id": alert_id}


@router.put("/{alert_id}/toggle", summary="Toggle price alert active status")
async def toggle_price_alert(
    alert_id: int,
    session: AsyncSession = Depends(get_async_session),
):
    """Toggle price alert active/inactive status."""
    return {"alert_id": alert_id, "is_active": True}