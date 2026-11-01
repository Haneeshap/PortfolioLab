# PortfolioLab Models - Notification
# Mirrors Java Notification entity and notifications table (Flyway V9__)

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Column, ForeignKey, String, DateTime, Text, Index, Integer
from sqlalchemy.orm import relationship

from app.core.database import Base


class Notification(Base):
    """Mirrors Java Notification entity and notifications table (Flyway V9__)."""

    __tablename__ = "notifications"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_id = Column(String(36), nullable=False, unique=True)  # UUID
    portfolio_id = Column(BigInteger, ForeignKey("portfolios.id"), nullable=False)
    user_id = Column(Integer, nullable=False, index=True)  # Added for audit/index
    is_read = Column(Boolean, nullable=False, default=False)  # Read flag
    source = Column(String(80), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    target_url = Column(String(300), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")
    read_at = Column(DateTime(timezone=True), nullable=True)  # Timestamp when read

    __table_args__ = (
        Index("ix_notifications_user_id_read", "user_id", "is_read"),
    )

    # Relationships
    portfolio = relationship("Portfolio", back_populates="notifications")
