# PortfolioLab Models - Activity
# Mirrors activity tracking entries (referenced by Portfolio.activity_entries)

from sqlalchemy import BigInteger, CheckConstraint, Column, ForeignKey, String, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Activity(Base):
    """Mirrors activity tracking entries.

    Stores user and system activity events for the application.
    Referenced by Portfolio.activity_entries relationship.
    """

    __tablename__ = "activities"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    portfolio_id = Column(BigInteger, ForeignKey("portfolios.id"), nullable=True)
    action = Column(String(80), nullable=False)  # e.g., DEPOSIT, WITHDRAW, TRADE, DIVIDEND
    description = Column(Text, nullable=True)
    activity_metadata = Column("metadata", Text, nullable=True)  # JSON extras
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")

    __table_args__ = (
        CheckConstraint(
            "action IN ('DEPOSIT','WITHDRAW','TRADE','DIVIDEND','TRANSFER','LOGIN','SIGNUP','PORTFOLIO_CREATE')",
            name="activity_action_check",
        ),
    )

    # Relationships
    portfolio = relationship("Portfolio", back_populates="activity_entries")