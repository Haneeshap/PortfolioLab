# PortfolioLab Models - Market Price Alert
# Mirrors Java MarketPriceAlert entity and market_price_alerts table (Flyway V12__)

from sqlalchemy import BigInteger, CheckConstraint, Column, ForeignKey, Numeric, String, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class MarketPriceAlert(Base):
    """Mirrors Java MarketPriceAlert entity and market_price_alerts table (Flyway V12__)."""

    __tablename__ = "market_price_alerts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    portfolio_id = Column(BigInteger, ForeignKey("portfolios.id"), nullable=False)
    symbol = Column(String(20), nullable=False)
    currency = Column(String(3), nullable=False)
    direction = Column(String(5), nullable=False)  # ABOVE/BELOW
    target_price = Column(Numeric(19, 4), nullable=False)
    last_price = Column(Numeric(19, 4), nullable=False, default=0)
    status = Column(String(12), nullable=False, default="ACTIVE")  # ACTIVE/TRIGGERED/CANCELLED
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    triggered_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("direction IN ('ABOVE','BELOW')", name="alert_direction_check"),
        CheckConstraint("status IN ('ACTIVE','TRIGGERED','CANCELLED')", name="alert_status_check"),
        CheckConstraint("(status = 'TRIGGERED') = (triggered_at IS NOT NULL)", name="status_triggers_check"),
    )

    # Relationships
    portfolio = relationship("Portfolio", back_populates="price_alerts")