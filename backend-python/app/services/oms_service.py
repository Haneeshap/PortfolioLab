from datetime import datetime
from decimal import Decimal
from enum import Enum, auto
from typing import Any, Optional

from sqlalchemy import DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from sqlalchemy.ext.asyncio import AsyncSession


class OrderStatus(Enum):
    SUBMITTED = "SUBMITTED"
    ACCEPTED = "ACCEPTED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class OrderSide(Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    DAY = "DAY"
    GTC = "GTC"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    uid: Mapped[str] = mapped_column(String(76), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="SUBMITTED")
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False, default="MARKET")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    filled_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    avg_fill_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    cash_reserved: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    shares_reserved: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReservationManager:
    def __init__(self, session_maker: Any) -> None:
        self.session_maker = session_maker

    async def reserve_cash(self, order_uid: str, amount: Decimal) -> None:
        pass

    async def reserve_shares(self, order_uid: str, quantity: int) -> None:
        pass

    async def release(self, order_uid: str) -> None:
        pass


class ExecutionEngine:
    def __init__(self, price_feed_url: str = "http://localhost:8081/prices"):
        self.price_feed_url = price_feed_url
        self._client: Any = None

    async def _get_client(self) -> Any:
        if self._client is None:
            import httpx
            self._client = httpx.AsyncClient(timeout=2.0)
        return self._client

    async def get_price(self, symbol: str) -> Optional[Decimal]:
        try:
            client = await self._get_client()
            resp = await client.get(f"{self.price_feed_url}/{symbol}")
            if resp.status_code == 200:
                data = resp.json()
                return Decimal(str(data.get("price", 0)))
        except Exception:
            pass
        return None

    async def simulate_fill(
        self, order_uid: str, quantity: int, side: str, symbol: str, session: AsyncSession
    ) -> dict[str, Any]:
        price = await self.get_price(symbol)
        if price is None:
            return {"filled": False, "reason": "no_price_available"}

        if side == OrderSide.BUY.value:
            total_cost = price * quantity
        else:
            total_cost = price * quantity

        return {"filled": True, "price": price, "quantity": quantity}


class OMSService:
    def __init__(self, session_maker: Any, reservation_mgr: ReservationManager, execution_engine: ExecutionEngine) -> None:
        self.session_maker = session_maker
        self.reservation_mgr = reservation_mgr
        self.execution_engine = execution_engine

    async def _insert_outbox_event(
        self, session: AsyncSession, order_uid: str, event_type: str, status: str
    ) -> None:
        """Insert outbox event for notification processing."""
        from sqlalchemy import insert

        stmt = insert(Order).values(
            outbox_event_type=event_type,
            outbox_event_status=status,
            outbox_event_timestamp=datetime.utcnow(),
        )
        await session.execute(stmt)

    async def create_order(
        self,
        uid: str,
        side: str,
        order_type: str,
        quantity: int,
        price: Optional[Decimal] = None,
        symbol: str = "UNKNOWN",
    ) -> dict[str, Any]:
        # ... existing code ...
        async with self.session_maker() as session:
            order = Order(
                uid=uid,
                status=OrderStatus.SUBMITTED.value,
                side=side,
                type=order_type,
                quantity=quantity,
                price=price,
                cash_reserved=None,
                shares_reserved=None,
            )
            session.add(order)
            await session.commit()
            await session.refresh(order)

            # Accept order
            order.status = OrderStatus.ACCEPTED.value
            await session.commit()

            # Insert outbox event for order placed notification
            await self._insert_outbox_event(session, uid, "ORDER_PLACED", order.status)

            # Simulate fill
            fill_result = await self.execution_engine.simulate_fill(
                order_uid=uid,
                quantity=quantity,
                side=side,
                symbol=symbol,
                session=session,
            )

            if fill_result["filled"]:
                order.status = OrderStatus.FILLED.value
                order.filled_quantity = quantity
                order.avg_fill_price = fill_result["price"]
                await session.commit()

                # Insert outbox event for order filled notification
                await self._insert_outbox_event(session, uid, "ORDER_FILLED", order.status)
            elif fill_result.get("reason") == "no_price_available":
                order.status = OrderStatus.REJECTED.value
                await session.commit()

                # Insert outbox event for order rejected notification
                await self._insert_outbox_event(session, uid, "ORDER_REJECTED", order.status)

        return {
            "id": order.id,
            "uid": order.uid,
            "status": order.status,
            "side": order.side,
            "type": order.type,
            "quantity": order.quantity,
            "filled_quantity": order.filled_quantity,
            "price": order.price,
            "avg_fill_price": order.avg_fill_price,
        }