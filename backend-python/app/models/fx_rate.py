# PortfolioLab Models - FX Rate

from sqlalchemy import BigInteger, Column, Numeric, String, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class FxRate(Base):
    """Mirrors Java FxRate entity and fx_rates table (Flyway V6__)."""

    __tablename__ = "fx_rates"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    base_currency = Column(String(3), nullable=False)
    quote_currency = Column(String(3), nullable=False)
    rate = Column(Numeric(19, 4), nullable=False)
    source = Column(String(40), nullable=True)  # e.g., "FRANKFURTER", "SIMULATED"
    captured_at = Column(DateTime, nullable=False)

    __table_args__ = (
        CheckConstraint("rate > 0", name="fx_rates_rate_check"),
        CheckConstraint(
            "base_currency < quote_currency", name="fx_rates_order_check",
        ),  # avoid duplicate inverted rows
    )

    # Relationships
    conversions = relationship("Transaction", back_populates="fx_rate_ref", cascade="all, delete-orphan")