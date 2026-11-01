# PortfolioLab Schemas - Portfolio, Holding, Transaction

from typing import Optional
from pydantic import BaseModel, Field


class PortfolioCreate(BaseModel):
    """Schema for creating a portfolio."""

    name: str = Field(..., min_length=1, max_length=200)
    initial_cash: Optional[float] = Field(0, ge=0)
    currency: Optional[str] = Field("INR", min_length=3, max_length=3)


class PortfolioUpdate(BaseModel):
    """Schema for updating a portfolio."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    cash_balance: Optional[float] = Field(None, ge=0)


class PortfolioResponse(BaseModel):
    """Schema for portfolio response."""

    id: int
    name: str
    cash_balance: float
    currency: str
    created_at: str

    class Config:
        from_attributes = True


class HoldingCreate(BaseModel):
    """Schema for creating a holding."""

    asset_id: int
    quantity: float = Field(gt=0)
    currency: Optional[str] = None


class HoldingResponse(BaseModel):
    """Schema for holding response."""

    id: int
    portfolio_id: int
    asset_id: int
    symbol: str
    name: str
    quantity: float
    historical_cost: float
    currency: str
    unrealized_pnl: Optional[float] = None

    class Config:
        from_attributes = True


class TransactionCreate(BaseModel):
    """Schema for creating a transaction."""

    asset_id: int
    side: str = Field(..., pattern="^(BUY|SELL)$")
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)
    fx_rate: Optional[float] = Field(None, ge=0)


class TransactionResponse(BaseModel):
    """Schema for transaction response."""

    id: int
    portfolio_id: int
    asset_id: int
    symbol: str
    side: str
    quantity: float
    price: float
    fx_rate: Optional[float]
    status: str
    created_at: str

    class Config:
        from_attributes = True