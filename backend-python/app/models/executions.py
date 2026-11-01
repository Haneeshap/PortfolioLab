# PortfolioLab Models - Execution
# Mirrors trade execution records (extension of transactions via Flyway V7__)

from sqlalchemy import BigInteger, CheckConstraint, Column, ForeignKey, Numeric, String, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Execution(Base):
    """Mirrors trade execution records.

    Flyway V7__ adds execution_fx_rate and portfolio_amount to the transactions table.
    This model represents standalone execution records for detailed trade tracking.
    """

    __tablename__ = "executions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    portfolio_id = Column(BigInteger, ForeignKey("portfolios.id"), nullable=False)
    asset_id = Column(BigInteger, ForeignKey("assets.id"), nullable=False)
    quantity = Column(Numeric(19, 6), nullable=False)
    price = Column(Numeric(19, 4), nullable=False)
    fx_rate = Column(Numeric(19, 4), nullable=True)
    execution_fx_rate = Column(Numeric(19, 4), nullable=True)  # V7__ addition
    portfolio_amount = Column(Numeric(19, 4), nullable=False)  # V7__ addition
    status = Column(String(20), nullable=False, default="SETTLED")
    executed_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="executions_quantity_check"),
        CheckConstraint("price >= 0", name="executions_price_check"),
        CheckConstraint("fx_rate IS NULL OR fx_rate > 0", name="executions_fx_rate_check"),
        CheckConstraint("portfolio_amount >= 0", name="executions_portfolio_amount_check"),
        CheckConstraint("status IN ('PENDING','SETTLED','FAILED','CANCELLED')", name="executions_status_check"),
    )

    # Relationships
    portfolio = relationship("Portfolio", back_populates="executions")
    asset = relationship("Asset", back_populates="executions")