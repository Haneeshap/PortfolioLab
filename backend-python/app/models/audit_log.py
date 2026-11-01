# PortfolioLab Models - Audit Log

from sqlalchemy import BigInteger, Column, Integer, String, Text, DateTime, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class AuditLog(Base):
    """Audit log table for tracking state changes across the enterprise system."""

    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(50), nullable=False)  # e.g., 'portfolio', 'order', 'holding'
    entity_id = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False)  # e.g., 'CREATE', 'UPDATE', 'DELETE'
    changes = Column(Text, nullable=True)
    performed_by = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())