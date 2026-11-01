# PortfolioLab Schemas - Asset

from typing import Optional
from pydantic import BaseModel


class AssetSearchResult(BaseModel):
    """Schema for asset search results."""

    assetId: int
    symbol: str
    name: Optional[str] = None
    sector: Optional[str] = None
    description: Optional[str] = None
    similarity: Optional[float] = None

    class Config:
        from_attributes = True


class Asset(BaseModel):
    """Schema for asset response."""

    id: int
    symbol: str
    name: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    sector: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True