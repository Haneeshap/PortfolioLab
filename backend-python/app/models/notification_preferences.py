# PortfolioLab Models - Notification Preferences
# Mirrors user notification preference settings

from sqlalchemy import BigInteger, CheckConstraint, Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class NotificationPreferences(Base):
    """Mirrors user notification preference settings.

    Stores per-user preferences for how and when they receive notifications.
    """

    __tablename__ = "notification_preferences"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False)  # References users.id
    email_notifications = Column(Boolean, nullable=False, default=True)
    push_notifications = Column(Boolean, nullable=False, default=True)
    sms_notifications = Column(Boolean, nullable=False, default=False)
    frequency = Column(String(20), nullable=False, default="IMMEDIATE")  # IMMEDIATE, HOURLY, DAILY, WEEKLY
    quiet_hours_start = Column(String(5), nullable=True)  # HH:MM format
    quiet_hours_end = Column(String(5), nullable=True)  # HH:MM format
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP", onupdate="CURRENT_TIMESTAMP")

    __table_args__ = (
        CheckConstraint(
            "frequency IN ('IMMEDIATE','HOURLY','DAILY','WEEKLY')",
            name="notification_prefs_frequency_check",
        ),
    )

    # Relationships