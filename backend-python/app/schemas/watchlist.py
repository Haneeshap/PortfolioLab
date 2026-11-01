# PortfolioLab Schemas - Watchlist, WatchlistItem

from typing import Optional, List
from pydantic import BaseModel, Field


class WatchlistCreate(BaseModel):
    """Schema for creating a watchlist."""
    portfolio_id: int
    name: str = Field(..., min_length=1, max_length=80)


class WatchlistUpdate(BaseModel):
    """Schema for updating a watchlist name."""
    name: str = Field(..., min_length=1, max_length=80)


class WatchlistResponse(BaseModel):
    """Schema for watchlist response."""
    id: int
    portfolio_id: int
    name: str
    created_at: str
    symbols: List[str] = []

    class Config:
        from_attributes = True


class WatchlistItemCreate(BaseModel):
    """Schema for adding an asset to a watchlist."""
    symbol: str = Field(..., min_length=1, max_length=20)


class WatchlistItemResponse(BaseModel):
    """Schema for watchlist item response."""
    watchlist_id: int
    asset_id: int
    symbol: str
    added_at: str


class MarketPriceAlertCreate(BaseModel):
    """Schema for creating a market price alert."""
    portfolio_id: int
    symbol: str = Field(..., min_length=1, max_length=20)
    currency: str = Field(..., min_length=3, max_length=3)
    direction: str = Field(..., pattern="^(ABOVE|BELOW)$")
    target_price: float = Field(..., gt=0)


class MarketPriceAlertUpdate(BaseModel):
    """Schema for updating an alert status."""
    status: str = Field(..., pattern="^(ACTIVE|TRIGGERED|CANCELLED)$")


class MarketPriceAlertResponse(BaseModel):
    """Schema for market price alert response."""
    id: int
    portfolio_id: int
    symbol: str
    currency: str
    direction: str
    target_price: float
    last_price: float
    status: str
    created_at: str
    triggered_at: Optional[str] = None

    class Config:
        from_attributes = True