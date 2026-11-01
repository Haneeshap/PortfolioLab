# PortfolioLab API Routes - Market

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_async_session
from app.models.simulated_order import SimulatedOrder
from app.schemas.simulated_order import SimulatedOrderResponse


router = APIRouter(prefix="/market", tags=["market"])


async def get_market_service():
    """Lazy dependency - market service that probes the Go simulator."""
    import httpx
    base_url = "http://127.0.0.1:8081"
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(f"{base_url}/prices")
            resp.raise_for_status()
            return resp.json()
        except Exception:
            raise HTTPException(status_code=503, detail="Market simulator unavailable")


@router.get("/prices", summary="Get current simulated market prices")
async def get_market_prices(
    session: AsyncSession = Depends(get_async_session),
):
    """Get current simulated market prices from the Go simulator."""
    prices = await get_market_service()
    return prices


@router.get("/orders", summary="List orders with current prices")
async def get_orders_with_prices(
    portfolio_id: int = Query(None),
    session: AsyncSession = Depends(get_async_session),
):
    """List orders with current simulated prices attached."""
    stmt = select(SimulatedOrder)
    if portfolio_id:
        stmt = stmt.where(SimulatedOrder.portfolio_id == portfolio_id)
    result = await session.execute(stmt)
    orders = result.scalars().all()
    return orders