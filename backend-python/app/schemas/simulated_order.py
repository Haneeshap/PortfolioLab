# PortfolioLab Schemas - Simulated Order

from typing import Optional
from pydantic import BaseModel, Field


class SimulatedOrderCreate(BaseModel):
    """Schema for creating a simulated order."""

    portfolio_id: int
    symbol: str = Field(..., min_length=1, max_length=20)
    side: str = Field(..., pattern="^(BUY|SELL)$")
    order_type: str = Field(default="MARKET", pattern="^(MARKET|LIMIT)$")
    limit_price: Optional[float] = Field(None, ge=0)
    time_in_force: str = Field(default="GTC", pattern="^(DAY|GTC)$")
    expires_at: Optional[str] = Field(None)


class SimulatedOrderUpdate(BaseModel):
    """Schema for updating a simulated order status."""

    status: str = Field(pattern="^(SUBMITTED|ACCEPTED|PARTIALLY_FILLED|FILLED|REJECTED|CANCELLED|EXPIRED)$")


class SimulatedOrderResponse(BaseModel):
    """Schema for simulated order response."""

    id: int
    portfolio_id: int
    symbol: str
    side: str
    order_type: str
    limit_price: Optional[float]
    time_in_force: str
    expires_at: Optional[str]
    status: str
    created_at: str

    class Config:
        from_attributes = True


class SimulatedOrderEventResponse(BaseModel):
    """Schema for simulated order event (from V20__)."""

    id: int
    portfolio_id: int
    order_id: int
    status: str
    requested_quantity: float
    filled_quantity: float
    created_at: str

    class Config:
        from_attributes = True