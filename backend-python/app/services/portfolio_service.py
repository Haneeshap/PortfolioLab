# PortfolioLab Portfolio Service
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.portfolio import Portfolio, Holding
from app.models.asset import Asset
from app.models.history_candles import HistoryCandle


async def _get_latest_prices(symbols: list[str], session: AsyncSession) -> dict[str, Decimal]:
    if not symbols:
        return {}
    latest_prices: dict[str, Decimal] = {}
    subquery = (
        select(HistoryCandle.symbol, func.max(HistoryCandle.observed_at).label("max_date"))
        .where(HistoryCandle.symbol.in_(symbols))
        .group_by(HistoryCandle.symbol)
        .subquery()
    )
    stmt = (
        select(HistoryCandle.symbol, HistoryCandle.close_price)
        .join(
            subquery,
            (HistoryCandle.symbol == subquery.c.symbol) & (HistoryCandle.observed_at == subquery.c.max_date),
        )
        .order_by(HistoryCandle.symbol)
    )
    result = await session.execute(stmt)
    rows = result.all()
    for symbol, close_price in rows:
        latest_prices[symbol] = Decimal(str(close_price)) if close_price else Decimal("0")
    return latest_prices

async def get_portfolio_service(portfolio_id: int, session: AsyncSession) -> dict[str, Any]:
    portfolio_stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
    result = await session.execute(portfolio_stmt)
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise ValueError(f"Portfolio {portfolio_id} not found")
    holdings_stmt = (
        select(Holding.asset_id, Holding.quantity, Holding.average_buy_price, Asset.symbol, Asset.currency)
        .join(Asset, Holding.asset_id == Asset.id)
        .where(Holding.portfolio_id == portfolio_id)
    )
    result = await session.execute(holdings_stmt)
    holdings_rows = result.all()
    holdings: list[dict[str, Any]] = []
    total_cost_basis = Decimal("0")
    total_market_value = Decimal("0")
    for row in holdings_rows:
        asset_id, quantity, avg_buy_price, symbol, currency = row
        holdings.append({
            "asset_id": asset_id,
            "symbol": symbol,
            "currency": currency,
            "quantity": quantity,
            "average_buy_price": avg_buy_price,
        })
        cost_basis = quantity * avg_buy_price if avg_buy_price else Decimal("0")
        total_cost_basis += cost_basis
    symbols = [h["symbol"] for h in holdings]
    latest_prices = await _get_latest_prices(symbols, session)
    for h in holdings:
        symbol = h["symbol"]
        quantity = h["quantity"]
        avg_buy_price = h["average_buy_price"]
        current_price = latest_prices.get(symbol)
        if current_price:
            h["current_price"] = current_price
            h["market_value"] = quantity * current_price
            h["cost_basis"] = quantity * avg_buy_price if avg_buy_price else Decimal("0")
            h["pnl"] = h["market_value"] - h["cost_basis"]
            h["pnl_pct"] = (h["pnl"] / h["cost_basis"] * 100) if h["cost_basis"] != 0 else Decimal("0")
            total_market_value += h["market_value"]
        else:
            h["current_price"] = avg_buy_price
            h["market_value"] = quantity * avg_buy_price if avg_buy_price else Decimal("0")
            h["cost_basis"] = h["market_value"]
            h["pnl"] = Decimal("0")
            h["pnl_pct"] = Decimal("0")
            total_market_value += h["market_value"]
    return {
        "portfolio_id": portfolio_id,
        "holdings": holdings,
        "total_cost_basis": total_cost_basis,
        "total_market_value": total_market_value,
    }
def calculate_weighted_attribution(
    holdings: list[dict[str, Any]],
    benchmark_returns: dict[str, float] | None = None,
) -> dict[str, Any]:
    total_value = sum(h.get("market_value", 0) or 0 for h in holdings)
    if total_value == 0:
        return {
            "total_portfolio_value": 0,
            "attribution": [],
            "total_weighted_return": 0,
        }
    attribution: list[dict[str, Any]] = []
    total_weighted_return = Decimal("0")
    for h in holdings:
        market_value = h.get("market_value", 0) or 0
        weight = (market_value / total_value * 100) if total_value > 0 else Decimal("0")
        pnl_pct = h.get("pnl_pct", 0) or 0
        weighted_contribution = weight * pnl_pct / 100 if weight != 0 else Decimal("0")
        total_weighted_return += weighted_contribution
        benchmark_return = benchmark_returns.get(h.get("symbol", ""), 0) if benchmark_returns else 0
        excess_return = pnl_pct - benchmark_return if benchmark_return else pnl_pct
        attribution.append({
            "symbol": h.get("symbol", ""),
            "weight": float(weight.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "portfolio_return": float(Decimal(str(pnl_pct)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "benchmark_return": float(benchmark_return) if benchmark_return else None,
            "excess_return": float(Decimal(str(excess_return)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "market_value": float(market_value),
        })
    attribution.sort(key=lambda x: abs(x["excess_return"] or 0), reverse=True)
    return {
        "total_portfolio_value": float(Decimal(str(total_value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)),
        "attribution": attribution,
        "total_weighted_return": float(total_weighted_return.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "generated_at": datetime.utcnow().isoformat(),
    }


async def get_performance_history(
    portfolio_id: int,
    period: str = "ALL",
    session: AsyncSession | None = None,
) -> list[dict[str, Any]]:
    if session is None:
        return []
    stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
    result = await session.execute(stmt)
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise ValueError(f"Portfolio {portfolio_id} not found")
    now = datetime.utcnow()
    if period == "7D":
        start_date = now - timedelta(days=7)
    elif period == "1M":
        start_date = now - timedelta(days=30)
    elif period == "3M":
        start_date = now - timedelta(days=90)
    else:
        start_date = None
    portfolio_data = await get_portfolio_service(portfolio_id, session)
    attribution = calculate_weighted_attribution(portfolio_data.get("holdings", []))
    return [attribution]


class PortfolioService:
    """Portfolio service for testing."""
    
    def __init__(self) -> None:
        pass
