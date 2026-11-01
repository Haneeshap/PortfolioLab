# PortfolioLab Models - Intelligence Notes
# Mirrors market intelligence events (Flyway V14__)

from sqlalchemy import BigInteger, CheckConstraint, Column, Integer, Numeric, String, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class IntelligenceNote(Base):
    """Mirrors market intelligence events (Flyway V14__).

    Stores market intelligence events with analysis and headlines.
    """

    __tablename__ = "intelligence_notes"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False)
    currency = Column(String(3), nullable=False)
    event_type = Column(String(30), nullable=False)  # e.g., EARNINGS, MERGER, UPGRADE, DOWNGRADE
    window_seconds = Column(Integer, nullable=False)
    start_price = Column(Numeric(19, 4), nullable=False)
    end_price = Column(Numeric(19, 4), nullable=False)
    change_percent = Column(Numeric(12, 4), nullable=False)
    headline = Column(String(220), nullable=False)
    explanation = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")

    __table_args__ = (
        CheckConstraint("window_seconds > 0", name="intelligence_window_check"),
        CheckConstraint("start_price > 0", name="intelligence_start_price_check"),
        CheckConstraint("end_price > 0", name="intelligence_end_price_check"),
        CheckConstraint("change_percent >= -500", name="intelligence_change_check"),
    )

    # Relationships