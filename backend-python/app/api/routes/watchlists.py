# PortfolioLab Watchlist Routes
from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.asset import Asset


router = APIRouter(prefix="/watchlists", tags=["watchlists"])


@router.get("", summary="List watchlists", response_model=list)
async def list_watchlists(
    session: AsyncSession = Depends(get_async_session),
) -> list[dict[str, Any]]:
    """List all watchlists."""
    # Placeholder - in production would query watchlist table
    return [
        {"id": 1, "name": "Default", "symbols": ["AAPL", "GOOGL", "MSFT"]},
        {"id": 2, "name": "Tech", "symbols": ["AAPL", "MSFT", "NVDA"]},
    ]


@router.get("/{watchlist_id}", summary="Get watchlist by ID")
async def get_watchlist(
    watchlist_id: int,
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Get watchlist by ID."""
    # Placeholder implementation
    if watchlist_id == 1:
        return {"id": 1, "name": "Default", "symbols": ["AAPL", "GOOGL", "MSFT"]}
    elif watchlist_id == 2:
        return {"id": 2, "name": "Tech", "symbols": ["AAPL", "MSFT", "NVDA"]}
    else:
        raise HTTPException(status_code=404, detail="Watchlist not found")


@router.post("", summary="Create watchlist")
async def create_watchlist(
    name: str = Query(...),
    symbols: str = Query(...),  # comma-separated
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Create a new watchlist."""
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    return {"id": 3, "name": name, "symbols": symbol_list}


@router.post("/{watchlist_id}/symbols", summary="Add symbols to watchlist")
async def add_watchlist_symbols(
    watchlist_id: int,
    symbols: str = Query(...),  # comma-separated
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Add symbols to a watchlist."""
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    return {"watchlist_id": watchlist_id, "added": symbol_list}


@router.delete("/{watchlist_id}/symbols/{symbol}", summary="Remove symbol from watchlist")
async def remove_watchlist_symbol(
    watchlist_id: int,
    symbol: str,
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Remove a symbol from a watchlist."""
    return {"watchlist_id": watchlist_id, "removed": symbol}