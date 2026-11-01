# PortfolioLab Models - User, Audit Log

from sqlalchemy import BigInteger, Column, String, Integer, Boolean, DateTime, Text, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    """Mirrors the users table and Java User entity."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="viewer", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def verify_password(self, password: str) -> bool:
        """Verify password against hash."""
        # Convert to str since SQLAlchemy Column may not be directly compatible
        hash_value = str(self.password_hash)  # type: ignore[arg-type]
        from app.core.security import verify_password as _verify_password
        return _verify_password(password, hash_value)  # type: ignore[arg-type]

    def get_display_name(self) -> str:
        """Get display name from email prefix."""
        return self.email.split("@")[0]