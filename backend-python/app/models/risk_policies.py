# PortfolioLab Models - Risk Policies
# Mirrors pre-trade risk policies (Flyway V15__)

from sqlalchemy import BigInteger, CheckConstraint, Column, Boolean, Numeric, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class RiskPolicy(Base):
    """Mirrors pre-trade risk policies (Flyway V15__).

    Stores risk policy configurations per portfolio with seed data.
    """

    __tablename__ = "risk_policies"

    portfolio_id = Column(BigInteger, ForeignKey("portfolios.id", ondelete="CASCADE"), primary_key=True)
    max_order_value = Column(Numeric(19, 4), nullable=False, default=50000)
    max_position_pct = Column(Numeric(5, 2), nullable=False, default=100)
    enabled = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP", onupdate="CURRENT_TIMESTAMP")

    __table_args__ = (
        CheckConstraint("max_order_value > 0", name="risk_max_order_value_check"),
        CheckConstraint("max_position_pct > 0", name="risk_max_position_pct_check"),
        CheckConstraint("max_position_pct <= 100", name="risk_max_position_pct_upper_check"),
    )

    # Relationships
    portfolio = relationship("Portfolio", back_populates="risk_policy")