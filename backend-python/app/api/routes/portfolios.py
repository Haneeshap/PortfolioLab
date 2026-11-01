# PortfolioLab API Routes - Portfolios

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.portfolio import Portfolio, Holding
from app.models.asset import Asset
from app.schemas.portfolio import PortfolioResponse, HoldingResponse


router = APIRouter(tags=["portfolios"])


@router.get("", summary="List portfolios", response_model=None)
async def list_portfolios(
    session: AsyncSession = Depends(get_async_session),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    sort: str = Query("created_at", description="Sort field"),
    order: str = Query("desc", regex="^(asc|desc)$", description="Sort order"),
):
    """List portfolios with pagination."""
    # Build sort column
    sort_column = Portfolio.created_at
    if sort == "id":
        sort_column = Portfolio.id
    elif sort == "name":
        sort_column = Portfolio.name
    elif sort == "cash_balance":
        sort_column = Portfolio.cash_balance

    try:
        # Build query with pagination and sorting
        stmt = select(Portfolio).order_by(
            sort_column.asc() if order == "asc" else sort_column.desc()
        )

        # Count total
        count_stmt = select(func.count()).select_from(Portfolio)
        total_result = await session.execute(count_stmt)
        total = total_result.scalar()

        # Apply pagination
        offset = (page - 1) * limit
        stmt = stmt.offset(offset).limit(limit)

        result = await session.execute(stmt)
        portfolios = result.scalars().all()

        items = []
        for p in portfolios:
            items.append({
                "id": p.id,
                "name": p.name,
                "cash_balance": float(p.cash_balance) if p.cash_balance is not None else 0.0,
                "currency": p.currency,
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit if total > 0 else 0,
        }
    except Exception:
        # Graceful fallback when database is unavailable
        return {
            "items": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "total_pages": 0,
        }


@router.get("/{portfolio_id}", summary="Get portfolio details")
async def get_portfolio(
    portfolio_id: int,
    session: AsyncSession = Depends(get_async_session),
):
    """Get portfolio by ID."""
    stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
    result = await session.execute(stmt)
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio


@router.get("/{portfolio_id}/performance", summary="Get portfolio performance")
async def get_portfolio_performance(
    portfolio_id: int,
    period: str = Query("ALL", regex="^(7D|1M|3M|ALL)$", description="Performance period: 7D, 1M, 3M, ALL"),
    session: AsyncSession = Depends(get_async_session),
):
    """Get portfolio performance for the given period."""
    from decimal import Decimal
    from datetime import datetime, timedelta

    # Check portfolio exists
    stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
    result = await session.execute(stmt)
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Determine lookback period
    now = datetime.utcnow()
    if period == "7D":
        start_date = now - timedelta(days=7)
    elif period == "1M":
        start_date = now - timedelta(days=30)
    elif period == "3M":
        start_date = now - timedelta(days=90)
    else:  # ALL
        start_date = None

    # Get holdings with current prices
    stmt = (
        select(Holding.asset_id, Holding.quantity, Asset.symbol, Asset.currency, Asset.id)
        .join(Asset, Holding.asset_id == Asset.id)
        .where(Holding.portfolio_id == portfolio_id)
    )
    result = await session.execute(stmt)
    holdings = result.all()

    if not holdings:
        return {
            "portfolio_id": portfolio_id,
            "period": period,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": now.isoformat(),
            "total_value": float(portfolio.cash_balance),
            "cash_balance": float(portfolio.cash_balance),
            "holdings": [],
            "performance": {
                "daily": None,
                "weekly": None,
                "monthly": None,
                "total_return": None,
            },
        }

    # Get latest price per asset from history_candles
    latest_prices = {}
    for holding in holdings:
        symbol = holding.symbol
        # Get most recent candle for this symbol
        candle_stmt = (
            select(HistoryCandle.close_price)
            .where(HistoryCandle.symbol == symbol)
            .order_by(HistoryCandle.observed_at.desc())
            .limit(1)
        )
        candle_result = await session.execute(candle_stmt)
        candle_price = candle_result.scalar_one_or_none()
        if candle_price:
            latest_prices[holding.asset_id] = candle_price

    # Calculate current value and P&L
    total_value = portfolio.cash_balance
    holdings_data = []
    total_cost = Decimal("0")

    for holding in holdings:
        quantity = holding.quantity
        avg_price = holding.average_buy_price
        cost_basis = quantity * avg_price
        total_cost += cost_basis

        asset_id = holding.asset_id
        current_price = latest_prices.get(asset_id)
        if current_price:
            market_value = quantity * current_price
            pnl = market_value - cost_basis
            pnl_pct = (pnl / cost_basis) * 100 if cost_basis != 0 else Decimal("0")
        else:
            market_value = cost_basis
            pnl = Decimal("0")
            pnl_pct = Decimal("0")

        total_value += market_value

        holdings_data.append({
            "asset_id": holding.asset_id,
            "symbol": holding.symbol,
            "quantity": float(quantity),
            "average_buy_price": float(avg_price),
            "current_price": float(current_price) if current_price else None,
            "market_value": float(market_value),
            "cost_basis": float(cost_basis),
            "pnl": float(pnl),
            "pnl_pct": float(pnl_pct),
        })

    # Calculate performance metrics
    overall_pnl = total_value - portfolio.cash_balance - total_cost  # value change from cost
    overall_pnl_pct = (overall_pnl / (total_cost if total_cost != 0 else Decimal("1"))) * 100

    return {
        "portfolio_id": portfolio_id,
        "period": period,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": now.isoformat(),
        "total_value": float(total_value),
        "cash_balance": float(portfolio.cash_balance),
        "invested_amount": float(total_cost),
        "holdings": holdings_data,
        "performance": {
            "daily": None,  # Would need time-series from history_candles
            "weekly": None,
            "monthly": None,
            "total_return": float(overall_pnl_pct),
        },
    }


@router.get("/rebalance/preview", summary="Get rebalance preview")
async def get_rebalance_preview(
    portfolio_id: int = Query(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Get rebalance preview for a portfolio."""
    from decimal import Decimal

    # Check portfolio exists
    stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
    result = await session.execute(stmt)
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Get current holdings
    stmt = (
        select(Holding.asset_id, Holding.quantity, Asset.symbol, Asset.currency, Asset.id)
        .join(Asset, Holding.asset_id == Asset.id)
        .where(Holding.portfolio_id == portfolio_id)
    )
    result = await session.execute(stmt)
    holdings = result.all()

    if not holdings:
        return {
            "portfolio_id": portfolio_id,
            "total_value": float(portfolio.cash_balance),
            "currency": portfolio.currency,
            "equal_weight_holdings": [],
            "rebalance_needed": False,
        }

    # Get latest prices for all holdings
    asset_ids = [h.asset_id for h in holdings]
    latest_prices = {}
    for asset_id in asset_ids:
        # Find the symbol for this asset_id
        sym_stmt = select(Asset.symbol).where(Asset.id == asset_id)
        sym_result = await session.execute(sym_stmt)
        symbol = sym_result.scalar_one_or_none()
        if symbol:
            candle_stmt = (
                select(HistoryCandle.close_price)
                .where(HistoryCandle.symbol == symbol)
                .order_by(HistoryCandle.observed_at.desc())
                .limit(1)
            )
            candle_result = await session.execute(candle_stmt)
            candle_price = candle_result.scalar_one_or_none()
            if candle_price:
                latest_prices[asset_id] = candle_price

    # Calculate current total value
    total_value = portfolio.cash_balance
    current_holdings = []

    for holding in holdings:
        quantity = holding.quantity
        asset_id = holding.asset_id
        current_price = latest_prices.get(asset_id)
        symbol = holding.symbol

        if current_price:
            market_value = quantity * current_price
        else:
            market_value = quantity * holding.average_buy_price

        total_value += market_value
        current_holdings.append({
            "asset_id": asset_id,
            "symbol": symbol,
            "quantity": float(quantity),
            "current_price": float(current_price) if current_price else float(holding.average_buy_price),
            "market_value": float(market_value),
            "currency": holding.currency,
        })

    # Calculate equal-weight allocation
    num_assets = len(current_holdings)
    if num_assets == 0:
        return {
            "portfolio_id": portfolio_id,
            "total_value": float(portfolio.cash_balance),
            "currency": portfolio.currency,
            "equal_weight_holdings": [],
            "rebalance_needed": False,
        }

    equal_weight = total_value / num_assets

    # Calculate what each holding should be at equal weight
    equal_weight_holdings = []
    for h in current_holdings:
        target_value = equal_weight
        target_quantity = target_value / h["current_price"] if h["current_price"] > 0 else 0
        delta_quantity = target_quantity - h["quantity"]
        delta_value = delta_quantity * h["current_price"] if h["current_price"] else Decimal("0")

        equal_weight_holdings.append({
            "asset_id": h["asset_id"],
            "symbol": h["symbol"],
            "current_quantity": h["quantity"],
            "target_quantity": target_quantity,
            "delta_quantity": delta_quantity,
            "delta_value": float(delta_value),
            "current_market_value": h["market_value"],
            "target_market_value": float(equal_weight),
        })

    total_delta = sum(abs(h["delta_value"]) for h in equal_weight_holdings)
    rebalance_needed = total_delta > 0.01  # threshold

    return {
        "portfolio_id": portfolio_id,
        "total_value": float(total_value),
        "currency": portfolio.currency,
        "equal_weight_holdings": equal_weight_holdings,
        "total_rebalance_delta": round(total_delta, 2),
        "rebalance_needed": rebalance_needed,
    }