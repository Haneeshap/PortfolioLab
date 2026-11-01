# PortfolioLab Order Service
# Mirrors Java OrderService logic for order validation, cash/shares reservation, and lifecycle management
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models.audit_log import AuditLog
from app.models.portfolio import Portfolio
from app.models.simulated_order import SimulatedOrder
from app.models.portfolio import Portfolio
from app.models.simulated_order import SimulatedOrder


class OrderService:
    """Order service mirroring Java OrderService - validates, reserves cash/shares, manages order lifecycle."""

    @staticmethod
    async def create_order(
        portfolio_id: int,
        symbol: str,
        side: str,
        order_type: str,
        limit_price: float | None = None,
        time_in_force: str = "GTC",
        expires_at: str | None = None,
    ) -> SimulatedOrder:
        """Create a new order with validation and cash/shares reservation."""
        async with async_session() as session:
            portfolio = await session.get(Portfolio, portfolio_id)
            if portfolio is None:
                raise ValueError(f"Portfolio {portfolio_id} not found")

            if side.upper() not in ("BUY", "SELL"):
                raise ValueError(f"Invalid side: {side}")

            if order_type.upper() not in ("MARKET", "LIMIT"):
                raise ValueError(f"Invalid order type: {order_type}")

            if order_type.upper() == "LIMIT" and (limit_price is None or limit_price <= 0):
                raise ValueError("LIMIT orders require a positive limit_price")

            if side.upper() == "BUY":
                from app.services.reservation_manager import ReservationManager
                await ReservationManager.reserve_cash(portfolio_id, limit_price or 0)

            if side.upper() == "SELL":
                from app.services.reservation_manager import ReservationManager
                await ReservationManager.reserve_shares(portfolio_id, symbol)

            db_order = SimulatedOrder(
                portfolio_id=portfolio_id,
                symbol=symbol,
                side=side,
                order_type=order_type,
                limit_price=limit_price,
                time_in_force=time_in_force,
                expires_at=expires_at,
                status="SUBMITTED",
            )
            session.add(db_order)
            await session.flush()
            await session.refresh(db_order)
            return db_order

    @staticmethod
    async def get_orders(
        portfolio_id: int | None = None,
        status: str | None = None,
    ) -> list[SimulatedOrder]:
        """List orders, optionally filtered by portfolio and status."""
        async with async_session() as session:
            stmt = select(SimulatedOrder)
            if portfolio_id:
                stmt = stmt.where(SimulatedOrder.portfolio_id == portfolio_id)
            if status:
                stmt = stmt.where(SimulatedOrder.status == status)
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def get_order_by_id(order_id: int) -> SimulatedOrder | None:
        """Get order by ID."""
        async with async_session() as session:
            stmt = select(SimulatedOrder).where(SimulatedOrder.id == order_id)
            result = await session.execute(stmt)
            return result.scalar_one_or_none()

    @staticmethod
    async def cancel_order(order_id: int) -> SimulatedOrder | None:
        """Cancel an order - transitions status to CANCELLED."""
        async with async_session() as session:
            stmt = select(SimulatedOrder).where(SimulatedOrder.id == order_id)
            result = await session.execute(stmt)
            order = result.scalar_one_or_none()
            if order is None:
                return None
            if order.status in ("FILLED", "REJECTED", "EXPIRED"):
                raise ValueError(f"Cannot cancel order with status: {order.status}")
            order.status = "CANCELLED"  # type: ignore[assignment]
            await session.flush()
            await session.refresh(order)
            return order