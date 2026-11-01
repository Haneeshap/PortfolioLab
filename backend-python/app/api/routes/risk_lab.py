# PortfolioLab Risk Lab Routes
from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.portfolio import Portfolio, Holding
from app.schemas.risk import RiskLabResponse, ShockScenarioResponse
from app.services.risk_service import RiskService


router = APIRouter(prefix="/risk-lab", tags=["risk-lab"])


@router.get("", summary="Risk lab analysis", response_model=RiskLabResponse)
async def risk_lab(
    portfolio_id: int = Query(..., description="Portfolio ID"),
    session: AsyncSession = Depends(get_async_session),
) -> RiskLabResponse:
    """Run comprehensive risk analysis on a portfolio."""
    # Get portfolio with holdings
    stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
    result = await session.execute(stmt)
    portfolio = result.scalar_one_or_none()
    
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get holdings with current prices
    stmt = (
        select(Holding.asset_id, Holding.quantity, Asset.symbol, Asset.currency, Asset.id)
        .join(Asset, Holding.asset_id == Asset.id)
        .where(Holding.portfolio_id == portfolio_id)
    )
    result = await session.execute(stmt)
    holdings = result.all()
    
    holdings_list = []
    for h in holdings:
        asset_id, quantity, symbol, currency, _ = h
        holdings_list.append({
            "asset_id": asset_id,
            "symbol": symbol,
            "currency": currency,
            "quantity": quantity,
        })
    
    # Calculate risk metrics
    hhi = RiskService.calculate_hhi(holdings_list)
    
    # Get latest prices for volatility calculation
    asset_ids = [h.asset_id for h in holdings]
    symbols = [h.symbol for h in holdings_list]
    
    # Calculate drawdown from holdings' performance (simplified)
    # In production, this would use historical price series
    sample_prices = [Decimal(str(h.market_value or 0)) for h in holdings_list if h.get("market_value")]
    
    risk_service = RiskService()
    volatility = risk_service.calculate_volatility(sample_prices if sample_prices else [Decimal("1")], period_days=30)
    drawdown = risk_service.calculate_drawdown(sample_prices if sample_prices else [Decimal("1")])
    
    return RiskLabResponse(
        portfolio_id=portfolio_id,
        hhi=round(hhi, 2),
        volatility=volatility,
        max_drawdown_pct=drawdown["max_drawdown_pct"],
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get("/scenario", summary="Apply shock scenario", response_model=ShockScenarioResponse)
async def risk_scenario(
    portfolio_id: int = Query(..., description="Portfolio ID"),
    shock_pct: float = Query(-0.10, ge=-1.0, le=1.0, description="Shock percentage (e.g., -0.10 for 10% drop)"),
    correlation: float = Query(1.0, ge=0.0, le=1.0, description="Correlation factor"),
    session: AsyncSession = Depends(get_async_session),
) -> ShockScenarioResponse:
    """Apply a shock scenario to portfolio and analyze impact."""
    # Get portfolio value
    stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
    result = await session.execute(stmt)
    portfolio = result.scalar_one_or_none()
    
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    portfolio_value = Decimal(str(portfolio.cash_balance or 0))
    
    # Apply shock scenario
    result = RiskService.scenario_shock(
        portfolio_value=portfolio_value,
        shock_pct=Decimal(str(shock_pct)),
        correlation=correlation,
    )
    
    return ShockScenarioResponse(
        portfolio_id=portfolio_id,
        shock_pct=result["shock_pct"],
        correlation=correlation,
        original_value=result["portfolio_value"],
        shocked_value=result["new_portfolio_value"],
        impact_pct=result["impact_pct"],
        timestamp=result["timestamp"],
    )