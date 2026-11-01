# PortfolioLab Schemas - Market Price Alert

from typing import Optional
from pydantic import BaseModel, Field


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