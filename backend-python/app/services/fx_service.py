# PortfolioLab FX Service
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.asset import Asset
from app.schemas.fx import FxConvertRequest, FxConvertResponse, FxReferenceResponse, FxAttributionResponse


router = APIRouter(prefix="/fx", tags=["fx"])


@router.get("/convert", summary="Convert between currencies", response_model=FxConvertResponse)
async def fx_convert(
    from_symbol: str = Query(..., description="From currency symbol"),
    to_symbol: str = Query(..., description="To currency symbol"),
    amount: float = Query(..., gt=0, description="Amount to convert"),
    session: AsyncSession = Depends(get_async_session),
) -> FxConvertResponse:
    """Convert amount from one currency to another using latest rates."""
    # Get from asset
    from_stmt = select(Asset).where(Asset.symbol == from_symbol.upper())
    from_result = await session.execute(from_stmt)
    from_asset = from_result.scalar_one_or_none()
    
    # Get to asset
    to_stmt = select(Asset).where(Asset.symbol == to_symbol.upper())
    to_result = await session.execute(to_stmt)
    to_asset = to_result.scalar_one_or_none()
    
    if from_asset is None or to_asset is None:
        raise HTTPException(status_code=404, detail="Currency not found")
    
    # Simple conversion: amount * (to_price / from_price)
    # In production, this would use central bank rates or FX desk rates
    if from_asset.price is None or to_asset.price is None:
        raise HTTPException(status_code=503, detail="FX rates not available")
    
    from_price = Decimal(str(from_asset.price))
    to_price = Decimal(str(to_asset.price))
    conversion_rate = to_price / from_price
    converted_amount = Decimal(str(amount)) * conversion_rate
    
    return FxConvertResponse(
        from_symbol=from_symbol,
        to_symbol=to_symbol,
        amount=amount,
        converted_amount=float(converted_amount),
        rate=float(conversion_rate),
        timestamp=datetime.utcnow(),
    )  # type: ignore[call-arg]


@router.get("/reference", summary="Get FX reference rates", response_model=List[FxReferenceResponse])
async def fx_reference(
    base: str = Query("USD", description="Base currency symbol"),
    session: AsyncSession = Depends(get_async_session),
) -> List[FxReferenceResponse]:
    """Get reference FX rates for base currency against other assets."""
    stmt = select(Asset).where(Asset.currency == base.upper())
    result = await session.execute(stmt)
    assets = result.scalars().all()
    
    responses = []
    for asset in assets:
        if asset.price is not None and asset.symbol != base.upper():
            rate = Decimal("1") / Decimal(str(asset.price))  # 1/asset_price gives rate vs base
            responses.append(
                FxReferenceResponse(
                    base=base,
                    quote=asset.symbol,
                    rate=float(rate),
                    asset_id=asset.id,
                    asset_name=asset.name,
                )  # type: ignore[call-arg]
            )
    
    return responses


@router.get("/attribution", summary="Get FX attribution analysis")
async def fx_attribution(
    portfolio_id: int = Query(..., description="Portfolio ID"),
    session: AsyncSession = Depends(get_async_session),
) -> FxAttributionResponse:
    """Get FX attribution for a portfolio."""
    from app.services.portfolio_service import get_portfolio_service
    
    portfolio = await get_portfolio_service(portfolio_id, session)
    
    # Calculate FX attribution based on currency exposure
    holdings = portfolio.get("holdings", [])
    
    attribution = []
    total_fx_return = Decimal("0")
    
    for holding in holdings:
        symbol = holding.get("symbol", "")
        currency = holding.get("currency", "USD")
        market_value = holding.get("market_value", 0) or 0
        
        if currency != "USD":
            fx_return = Decimal(str(market_value)) * Decimal("0.01")  # placeholder FX return
            total_fx_return += fx_return
            attribution.append({
                "symbol": symbol,
                "currency": currency,
                "market_value": float(market_value),
                "fx_return": float(fx_return),
            })
    
    return FxAttributionResponse(
        portfolio_id=portfolio_id,
        total_fx_return=float(total_fx_return.quantize(Decimal("0.01"))),
        attribution=attribution,
        generated_at=datetime.utcnow().isoformat(),
    )  # type: ignore[call-arg]