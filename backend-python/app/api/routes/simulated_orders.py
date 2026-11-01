# PortfolioLab API Routes - Simulated Orders

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.simulated_order import SimulatedOrder
from app.schemas.simulated_order import (
    SimulatedOrderCreate,
    SimulatedOrderUpdate,
    SimulatedOrderResponse,
    SimulatedOrderEventResponse,
)


router = APIRouter(prefix="/simulated-orders", tags=["simulated-orders"])


@router.post("", summary="Create a simulated order", response_model=SimulatedOrderResponse)
async def create_order(
    order: SimulatedOrderCreate,
    session: AsyncSession = Depends(get_async_session),
) -> SimulatedOrderResponse:
    """Create a new simulated order."""
    db_order = SimulatedOrder(
        portfolio_id=order.portfolio_id,
        symbol=order.symbol,
        side=order.side,
        order_type=order.order_type,
        limit_price=order.limit_price,
        time_in_force=order.time_in_force,
        expires_at=order.expires_at,
        status="SUBMITTED",
    )
    session.add(db_order)
    await session.flush()
    await session.refresh(db_order)
    return db_order


@router.get("", summary="List simulated orders", response_model=list)
async def list_orders(
    portfolio_id: int = Query(None),
    status: str = Query(None),
    session: AsyncSession = Depends(get_async_session),
) -> list[SimulatedOrder]:
    """List simulated orders, optionally filtered by portfolio and status."""
    stmt = select(SimulatedOrder)
    if portfolio_id:
        stmt = stmt.where(SimulatedOrder.portfolio_id == portfolio_id)
    if status:
        stmt = stmt.where(SimulatedOrder.status == status)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{order_id}", summary="Get order details")
async def get_order(
    order_id: int,
    session: AsyncSession = Depends(get_async_session),
) -> SimulatedOrder:
    """Get order by ID."""
    stmt = select(SimulatedOrder).where(SimulatedOrder.id == order_id)
    result = await session.execute(stmt)
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}/status", summary="Update order status")
async def update_order_status(
    order_id: int,
    status: str = Query(...,
        pattern="^(SUBMITTED|ACCEPTED|PARTIALLY_FILLED|FILLED|REJECTED|CANCELLED|EXPIRED)$"),
    session: AsyncSession = Depends(get_async_session),
) -> SimulatedOrder:
    """Update order status."""
    stmt = select(SimulatedOrder).where(SimulatedOrder.id == order_id)
    result = await session.execute(stmt)
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = status
    await session.flush()
    return order