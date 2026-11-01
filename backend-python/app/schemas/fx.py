# PortfolioLab FX Schemas
from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Any


class FxConvertRequest:
    """Request model for FX conversion."""
    from_symbol: str
    to_symbol: str
    amount: float


class FxConvertResponse:
    """Response model for FX conversion."""
    from_symbol: str
    to_symbol: str
    amount: float
    converted_amount: float
    rate: float
    timestamp: datetime


class FxReferenceResponse:
    """Response model for FX reference rates."""
    base: str
    quote: str
    rate: float
    asset_id: int
    asset_name: str


class FxAttributionResponse:
    """Response model for FX attribution analysis."""
    portfolio_id: int
    total_fx_return: float
    attribution: list[Any]
    generated_at: str