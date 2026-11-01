# PortfolioLab Models - Refresh Token
# Mirrors refresh token records for session management

from sqlalchemy import BigInteger, CheckConstraint, Column, String, DateTime, Text, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class RefreshToken(Base):
    """Mirrors refresh token records for session management.

    Stores refresh tokens for maintaining user sessions.
    """

    __tablename__ = "refresh_tokens"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False)  # References users.id
    token_hash = Column(String(255), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")

    __table_args__ = (
        CheckConstraint("expires_at > created_at", name="refresh_token_expires_check"),
    )

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")