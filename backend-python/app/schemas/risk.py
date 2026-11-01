# PortfolioLab Risk Schemas
from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, List


class RiskLabResponse:
    """Response model for risk lab analysis."""
    portfolio_id: int
    hhi: float
    volatility: float
    max_drawdown_pct: float
    timestamp: str


class ShockScenarioResponse:
    """Response model for shock scenario analysis."""
    portfolio_id: int
    shock_pct: float
    correlation: float
    original_value: float
    shocked_value: float
    impact_pct: float
    timestamp: str


class HoldinsSummary:
    """Summary of portfolio holdings for risk analysis."""
    asset_id: int
    symbol: str
    currency: str
    quantity: int
    market_value: Optional[float] = None