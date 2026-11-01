# PortfolioLab Schemas - Notification, Watchlist, Price Alert

from typing import Optional
from pydantic import BaseModel, Field


class NotificationCreate(BaseModel):
    """Schema for creating a notification."""

    portfolio_id: int
    event_id: str = Field(..., pattern="^[0-9a-f-]{36}$")
    source: str = Field(..., max_length=80)
    title: str = Field(..., max_length=200)
    message: str = Field(...)
    target_url: Optional[str] = Field(None)


class NotificationResponse(BaseModel):
    """Schema for notification response."""

    id: int
    event_id: str
    portfolio_id: int
    source: str
    title: str
    message: str
    target_url: Optional[str]
    created_at: str
    read_at: Optional[str]

    class Config:
        from_attributes = True


class NotificationMarkRead(BaseModel):
    """Schema for marking a notification as read/unread."""

    read: bool


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
    symbols: list[str] = []

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

    status: str = Field(pattern="^(ACTIVE|TRIGGERED|CANCELLED)$")


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
    triggered_at: Optional[str]

    class Config:
        from_attributes = True