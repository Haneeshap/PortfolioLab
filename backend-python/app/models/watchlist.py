# PortfolioLab Models - Watchlist, WatchlistItem
# Mirrors Java Watchlist entity and watchlists table (Flyway V13__)

from sqlalchemy import BigInteger, Column, ForeignKey, String, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Watchlist(Base):
    """Mirrors Java Watchlist entity and watchlists table (Flyway V13__)."""

    __tablename__ = "watchlists"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    portfolio_id = Column(BigInteger, ForeignKey("portfolios.id"), nullable=False)
    name = Column(String(80), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    portfolio = relationship("Portfolio", back_populates="watchlists")
    items = relationship("WatchlistItem", back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistItem(Base):
    """Mirrors watchlist_items table (Flyway V13__)."""

    __tablename__ = "watchlist_items"

    watchlist_id = Column(BigInteger, ForeignKey("watchlists.id"), primary_key=True)
    asset_id = Column(BigInteger, ForeignKey("assets.id"), primary_key=True)
    added_at = Column(DateTime(timezone=True), nullable=True)