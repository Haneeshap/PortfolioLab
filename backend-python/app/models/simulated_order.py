# PortfolioLab Models - Simulated Order
# Mirrors Java SimulatedOrder entity and simulated_orders table (Flyway V18__limit_orders).

from sqlalchemy import BigInteger, CheckConstraint, Column, ForeignKey, Numeric, String, DateTime, Text, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


class SimulatedOrder(Base):
    """Mirrors Java SimulatedOrder entity and simulated_orders table.

    Flyway V18__ adds: order_type, limit_price, time_in_force, expires_at constraints.
    """

    __tablename__ = "simulated_orders"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    portfolio_id = Column(BigInteger, ForeignKey("portfolios.id"), nullable=False)
    symbol = Column(String(20), nullable=False)
    side = Column(String(10), nullable=False)  # BUY/SELL
    order_type = Column(String(6), nullable=False, default="MARKET")
    limit_price = Column(Numeric(19, 4), nullable=True)
    time_in_force = Column(String(3), nullable=False, default="GTC")
    expires_at = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="SUBMITTED")
    created_at = Column(DateTime, nullable=False, server_default="NOW()")

    __table_args__ = (
        Index("ix_simulated_orders_portfolio_status", "portfolio_id", "status"),
        CheckConstraint(
            "order_type='MARKET' AND limit_price IS NULL OR order_type='LIMIT' AND limit_price IS NOT NULL AND limit_price > 0",
            name="valid_limit_check",
        ),
        CheckConstraint(
            "time_in_force IN ('DAY','GTC')", name="valid_time_in_force_check",
        ),
        CheckConstraint(
            "status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED','FILLED','REJECTED','CANCELLED','EXPIRED')",
            name="status_check",
        ),
    )

    # Relationships
    portfolio = relationship("Portfolio", back_populates="transactions")
    events = relationship("SimulatedOrderEvent", back_populates="order", cascade="all, delete-orphan")