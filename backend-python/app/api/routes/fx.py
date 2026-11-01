# PortfolioLab FX Routes - Simplified
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import get_async_session
from app.services.fx import convert


router = APIRouter(prefix="/fx", tags=["fx"])


@router.get("/convert", summary="Convert between currencies")
async def api_fx_convert(
    from_symbol: str = Query(..., description="From currency symbol"),
    to_symbol: str = Query(..., description="To currency symbol"),
    amount: float = Query(..., gt=0, description="Amount to convert"),
    session: AsyncSession = Depends(get_async_session),
):
    """Convert amount from one currency to another using reference rates."""
    return convert(amount, from_symbol, to_symbol)
