# PortfolioLab Execution Engine
# Mirrors Java ExecutionEngine logic for simulating order fills using Go market simulator prices
import httpx
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models.simulated_order import SimulatedOrder


class ExecutionEngine:
    """Execution engine that simulates order fills using the Go market simulator.

    Connects to http://localhost:8081/prices to get real-time prices
    and simulates order fills based on MARKET/LIMIT logic.
    """

    @staticmethod
    async def _get_current_price() -> float:
        """Get current market price from the Go price simulator."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get("http://127.0.0.1:8081/prices")
                if resp.status_code == 200:
                    price_data = resp.json()
                    return float(price_data.get("price", 0.0))
        except Exception:
            pass
        return 0.0

    @staticmethod
    async def simulate_fill(order: SimulatedOrder) -> dict[str, Any]:
        """Simulate order fill using the Go market price simulator.

        For MARKET orders: fills at current market price
        For LIMIT orders: fills only if market price crosses limit price
        """
        current_price = await ExecutionEngine._get_current_price()

        fill_price: float | None = current_price
        new_status: str = str(order.status)

        if order.order_type.upper() == "MARKET":
            # Market order fills at current price
            new_status = "FILLED"
            fill_price = current_price
        elif order.order_type.upper() == "LIMIT":
            # LIMIT order fills if market price crosses limit price
            side = order.side.upper()
            limit_price = float(order.limit_price or 0)

            if side == "BUY" and current_price <= limit_price:
                # Market crossed limit for BUY - order fills
                new_status = "FILLED"
                fill_price = limit_price
            elif side == "SELL" and current_price >= limit_price:
                # Market crossed limit for SELL - order fills
                new_status = "FILLED"
                fill_price = limit_price
            else:
                # Price not crossed yet
                new_status = "PARTIALLY_FILLED"
                fill_price = None

        # Update the order status in the database
        async with async_session() as session:
            stmt = select(SimulatedOrder).where(SimulatedOrder.id == order.id)
            result = await session.execute(stmt)
            db_order = result.scalar_one_or_none()
            if db_order:
                db_order.status = new_status  # type: ignore[assignment]
                await session.flush()
                await session.refresh(db_order)

        return {
            "order_id": order.id,
            "fill_price": fill_price,
            "status": new_status,
            "side": order.side,
        }

    @staticmethod
    async def process_order_lifecycle(order_id: int) -> dict[str, Any]:
        """Process the full lifecycle of an order - check prices, update status, etc."""
        async with async_session() as session:
            stmt = select(SimulatedOrder).where(SimulatedOrder.id == order_id)
            result = await session.execute(stmt)
            order = result.scalar_one_or_none()

            if order is None:
                raise ValueError(f"Order {order_id} not found")

            # If already in terminal state, return early
            if order.status in ("FILLED", "REJECTED", "CANCELLED", "EXPIRED"):
                return {"order_id": order.id, "status": order.status, "message": "Order already in terminal state"}

        # Get current price from simulator and determine fill
        fill_result = await ExecutionEngine.simulate_fill(order)

        # Release/reserve appropriate cash/shares based on the fill
        # (simplified - full implementation would handle the accounting)

        return fill_result