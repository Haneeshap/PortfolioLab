# PortfolioLab Models - Outbox Events
# Mirrors outbox/event publishing tables (Flyway V9__ + V14__)

from sqlalchemy import BigInteger, CheckConstraint, Column, String, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class OutboxEvent(Base):
    """Mirrors outbox/event publishing tables.

    Flyway V9__ creates notification_outbox for notification events.
    Flyway V14__ creates market_intelligence_outbox for intelligence events.
    This model represents the unified outbox for async event processing.
    """

    __tablename__ = "outbox_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_type = Column(String(80), nullable=False)  # e.g., NOTIFICATION, INTELLIGENCE
    entity_type = Column(String(50), nullable=False)  # e.g., PORTFOLIO, ASSET, INTELLIGENCE_NOTE
    entity_id = Column(BigInteger, nullable=False)
    payload = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")
    published_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('NOTIFICATION','INTELLIGENCE','RISK','EXECUTION')",
            name="outbox_event_type_check",
        ),
        CheckConstraint(
            "entity_type IN ('PORTFOLIO','ASSET','INTELLIGENCE_NOTE','TRANSACTION')",
            name="outbox_entity_type_check",
        ),
        # Index for unpublished events (used by publisher process)
        # Note: Index definition would be in migration
    )

    # Relationships