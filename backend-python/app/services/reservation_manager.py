# PortfolioLab Reservation Manager
# Mirrors Java ReservationManager logic for cash and shares reservation tracking
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models.portfolio import Portfolio


class ReservationManager:
    """Reservation manager for cash and shares - mirrors Java ReservationManager logic."""

    @staticmethod
    async def reserve_cash(portfolio_id: int, amount: float) -> None:
        """Reserve cash for an order."""
        async with async_session() as session:
            stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
            result = await session.execute(stmt)
            portfolio = result.scalar_one_or_none()
            if portfolio is None:
                raise ValueError(f"Portfolio {portfolio_id} not found")
            if portfolio.reserved_cash is not None:  # type: ignore[attr-defined]
                portfolio.reserved_cash += amount  # type: ignore[attr-defined]
            await session.flush()

    @staticmethod
    async def reserve_shares(
        portfolio_id: int, symbol: str, quantity: int = 1
    ) -> None:
        """Reserve shares for a sell order."""
        async with async_session() as session:
            stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
            result = await session.execute(stmt)
            portfolio = result.scalar_one_or_none()
            if portfolio is None:
                raise ValueError(f"Portfolio {portfolio_id} not found")
            portfolio.reserved_shares[symbol] = (  # type: ignore[attr-defined]
                portfolio.reserved_shares.get(symbol, 0) + quantity  # type: ignore[attr-defined]
            )
            await session.flush()

    @staticmethod
    async def release_cash(portfolio_id: int, amount: float) -> None:
        """Release reserved cash (on cancel or partial fill)."""
        async with async_session() as session:
            stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
            result = await session.execute(stmt)
            portfolio = result.scalar_one_or_none()
            if portfolio is None:
                raise ValueError(f"Portfolio {portfolio_id} not found")
            if portfolio.reserved_cash is not None and portfolio.reserved_cash >= amount:  # type: ignore[attr-defined]
                portfolio.reserved_cash -= amount  # type: ignore[attr-defined]
            await session.flush()

    @staticmethod
    async def release_shares(
        portfolio_id: int, symbol: str, quantity: int = 1
    ) -> None:
        """Release reserved shares (on cancel or partial fill)."""
        async with async_session() as session:
            stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
            result = await session.execute(stmt)
            portfolio = result.scalar_one_or_none()
            if portfolio is None:
                raise ValueError(f"Portfolio {portfolio_id} not found")
            current = portfolio.reserved_shares.get(symbol, 0)  # type: ignore[attr-defined]
            if current >= quantity:
                portfolio.reserved_shares[symbol] = current - quantity  # type: ignore[attr-defined]
                if portfolio.reserved_shares[symbol] == 0:  # type: ignore[attr-defined]
                    del portfolio.reserved_shares[symbol]  # type: ignore[attr-defined]
            await session.flush()