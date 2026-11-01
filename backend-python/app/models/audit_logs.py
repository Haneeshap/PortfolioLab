# PortfolioLab Models - Audit Log
# Mirrors audit log entries for tracking changes (new table)

from sqlalchemy import BigInteger, CheckConstraint, Column, String, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class AuditLog(Base):
    """Mirrors audit log entries for tracking changes.

    Stores audit trail entries for all significant operations.
    """

    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=True)  # References users.id (may be NULL for system actions)
    action = Column(String(80), nullable=False)  # e.g., CREATE, UPDATE, DELETE, LOGIN, LOGOUT
    entity_type = Column(String(50), nullable=False)  # e.g., PORTFOLIO, ASSET, TRANSACTION
    entity_id = Column(BigInteger, nullable=False)
    before = Column(Text, nullable=True)  # JSON snapshot before change
    after = Column(Text, nullable=True)  # JSON snapshot after change
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")

    __table_args__ = (
        CheckConstraint(
            "action IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','TRANSFER','DIVIDEND','TRADE')",
            name="audit_action_check",
        ),
    )

    # Relationships
    user = relationship("User", back_populates="audit_logs")