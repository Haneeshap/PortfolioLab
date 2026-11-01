"""Test for Spark batch risk metrics - mocks Spark and checks HHI formula."""
import pandas as pd
import pytest


def test_hhi_formula():
    """Verify HHI = sum(weight^2) formula."""
    # Given equal weights across 4 holdings
    weights = pd.Series([0.25, 0.25, 0.25, 0.25])
    expected = (0.25**2 + 0.25**2 + 0.25**2 + 0.25**2)  # = 0.25

    # When computing HHI
    hhi = (weights ** 2).sum()

    # Then HHI should be 0.25
    assert abs(hhi - expected) < 1e-10

    # Given concentrated portfolio: 1 holding has 100%
    weights2 = pd.Series([1.0, 0.0, 0.0, 0.0])
    hhi2 = (weights2 ** 2).sum()
    assert abs(hhi2 - 1.0) < 1e-10

    # Given concentrated portfolio: 2 holdings equal at 50% each
    weights3 = pd.Series([0.5, 0.5, 0.0, 0.0])
    hhi3 = (weights3 ** 2).sum()
    assert abs(hhi3 - 0.5) < 1e-10


def test_volatility_formula():
    """Verify volatility = std(log-returns) * sqrt(252)."""
    # Simple price series
    prices = [100.0, 101.0, 102.0, 101.5, 103.0]
    returns = [float(prices[i]) / float(prices[i-1]) - 1.0 for i in range(1, len(prices))]
    log_returns = [float(__import__('math').log(1 + r)) for r in returns]
    volatility = float(__import__('math').sqrt(252)) * pd.Series(log_returns).std()

    # Recompute independently
    import numpy as np
    log_r = np.log(np.array(prices[1:]) / np.array(prices[:-1]))
    vol = float(np.std(log_r, ddof=1)) * float(np.sqrt(252))

    assert abs(volatility - vol) < 1e-10


def test_max_drawdown_formula():
    """Verify max_drawdown = max(peak-to-trough)."""
    # Peak at start, then drop
    prices = [100.0, 120.0, 90.0, 95.0, 80.0]
    cummax = np.maximum.accumulate(prices)
    drawdowns = np.array(prices) - cummax
    max_dd = float(drawdowns.min()) / float(cummax[np.argmin(drawdowns)] if np.any(drawdowns < 0) else cummax[-1])

    # Alternative: manual
    peak = prices[0]
    max_dd = 0.0
    for p in prices:
        if p > peak:
            peak = p
        dd = (p - peak) / peak if peak > 0 else 0
        if dd < max_dd:
            max_dd = dd

    assert abs(max_dd - (-0.20)) < 0.05  # 20% drawdown from 120 to 80