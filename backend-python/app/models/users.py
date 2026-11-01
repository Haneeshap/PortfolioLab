# PortfolioLab Models - User
# Mirrors application users (new table for auth support)

from sqlalchemy import BigInteger, CheckConstraint, Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    """Mirrors application users.

    New table for authentication and authorization support.
    """

    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="USER")  # USER, ADMIN, SUPERUSER
    is_active = Column(Boolean, nullable=False, default=True)
    is_email_verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "role IN ('USER','ADMIN','SUPERUSER')",
            name="users_role_check",
        ),
    )

    # Relationships
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")