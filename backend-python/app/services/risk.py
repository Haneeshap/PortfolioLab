# PortfolioLab Risk Service - Simplified
from __future__ import annotations
from decimal import Decimal
from typing import Optional, Dict, List, Any

import numpy as np


class RiskService:
    """Risk analysis service - simplified to 3 core functions."""

    @staticmethod
    def calculate_hhi(holdings: List[Dict[str, Any]]) -> float:
        """Calculate Herfindahl-Hirschman Index for concentration risk.

        HHI = sum(si^2) where si is the market share (percentage) of holding i.
        Range: 0-10000, where >2500 indicates high concentration.
        """
        if not holdings:
            return 0.0

        total_value = sum(h.get("market_value", 0) or 0 for h in holdings)
        if total_value == 0:
            return 0.0

        shares_squared = sum(
            (
                Decimal(str(h.get("market_value", 0) or 0))
                / Decimal(str(total_value))
            ) ** 2
            for h in holdings
            if h.get("market_value") and h["market_value"] > 0
        )

        return float(shares_squared * 10000)

    @staticmethod
    def calculate_volatility(prices: List[Decimal], period_days: int = 30) -> float:
        """Calculate annualized volatility from price series.

        Uses standard deviation of logarithmic returns, annualized by sqrt(252).
        """
        if len(prices) < 2:
            return 0.0

        # Calculate log returns
        returns = []
        for i in range(1, len(prices)):
            if prices[i - 1] > 0 and prices[i] > 0:
                log_return = float(np.log(float(prices[i]) / float(prices[i - 1])))
                returns.append(log_return)

        if not returns:
            return 0.0

        # Standard deviation of returns
        std_dev = np.std(returns, ddof=1)  # sample std dev

        annualized = float(std_dev * np.sqrt(252))

        return round(annualized, 4)

    @staticmethod
    def calculate_max_drawdown(equity_curve: List[Decimal]) -> Dict[str, Any]:
        """Calculate maximum drawdown from equity curve.

        Returns: peak, trough, max_drawdown_pct, recovery
        """
        if not equity_curve or len(equity_curve) < 2:
            return {
                "peak": float(equity_curve[0]) if equity_curve else 0,
                "trough": float(equity_curve[0]) if equity_curve else 0,
                "max_drawdown_pct": 0.0,
                "recovery": 0.0,
            }

        peak = equity_curve[0]
        max_dd = 0.0
        trough = equity_curve[0]

        for price in equity_curve:
            if price > peak:
                peak = price
            drawdown = float(peak - price) / float(peak) if peak > 0 else 0
            if drawdown > max_dd:
                max_dd = drawdown
                trough = price

        return {
            "peak": float(peak),
            "trough": float(trough),
            "max_drawdown_pct": round(max_dd * 100, 2),
            "recovery": round((peak - trough) / trough * 100, 2) if trough > 0 else 0,
        }
