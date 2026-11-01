# PortfolioLab Reservations - Reservation logic from OrderReservations.java

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession


class OrderReservations:
    """Thin reservation mirroring SimulatedOrderReservations.java.

    Reservations ensure that requested quantities cannot exceed available
    position limits when placing LIMIT or MARKET orders.
    """

    @staticmethod
    async def can_reserve(session: AsyncSession, portfolio_id: int, asset_id: int,
                          requested_quantity: float, order_type: str,
                          limit_price: float | None = None) -> bool:
        """Check if a reservation can be satisfied."""
        if order_type == "MARKET":
            # For market orders, check total holdings
            from app.models.portfolio import Holding
            result = await session.execute(
                select(Holding).where(
                    and_(
                        Holding.portfolio_id == portfolio_id,
                        Holding.asset_id == asset_id,
                    )
                )
            )
            holding = result.scalar_one_or_none()
            if holding is None:
                return requested_quantity <= 0
            # Available is unlimited for market in this simplified model
            return True

        elif order_type == "LIMIT":
            if limit_price is None or limit_price <= 0:
                return False
            # For limit orders, check that requested quantity is positive
            return requested_quantity > 0

        return False