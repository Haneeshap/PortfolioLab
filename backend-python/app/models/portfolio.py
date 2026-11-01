# PortfolioLab Models - Portfolio, Holding, Transaction
# Mirrors Java entities and Flyway V3-V11 migrations

from sqlalchemy import BigInteger, CheckConstraint, Column, ForeignKey, Numeric, String, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Portfolio(Base):
    """Mirrors Java Portfolio entity and portfolios table (Flyway V3__)."""

    __tablename__ = "portfolios"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    cash_balance = Column(Numeric(19, 4), nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="INR")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")

    # Relationships
    holdings = relationship("Holding", back_populates="portfolio", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")
    watchlists = relationship("Watchlist", back_populates="portfolio", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="portfolio", cascade="all, delete-orphan")
    activity_entries = relationship("Activity", back_populates="portfolio", cascade="all, delete-orphan")


class Holding(Base):
    """Mirrors Java Holding entity and holdings table (Flyway V3__+V8__)."""

    __tablename__ = "holdings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    portfolio_id = Column(BigInteger, ForeignKey("portfolios.id"), nullable=False)
    asset_id = Column(BigInteger, ForeignKey("assets.id"), nullable=False)
    quantity = Column(Numeric(19, 6), nullable=False)
    average_buy_price = Column(Numeric(19, 4), nullable=False)
    historical_cost_portfolio = Column(Numeric(19, 4), nullable=False, default=0)
    currency = Column(String(3), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="holdings_quantity_check"),
        CheckConstraint("average_buy_price >= 0", name="holdings_average_buy_price_check"),
        CheckConstraint("historical_cost_portfolio >= 0", name="holdings_cost_check"),
        # V3 uniqueness enforcement
        # V8 adds historical_cost_portfolio tracking
    )

    # Relationships
    portfolio = relationship("Portfolio", back_populates="holdings")
    asset = relationship("Asset", foreign_keys=[asset_id])


class Transaction(Base):
    """Mirrors Java Transaction entity and transactions table (Flyway V7__)."""

    __tablename__ = "transactions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    portfolio_id = Column(BigInteger, ForeignKey("portfolios.id"), nullable=False)
    asset_id = Column(BigInteger, nullable=False)
    transaction_type = Column(String(10), nullable=False)  # BUY/SELL
    quantity = Column(Numeric(19, 6), nullable=False)
    price = Column(Numeric(19, 4), nullable=False)
    fx_rate = Column(Numeric(19, 4), nullable=True)
    historical_cost_portfolio = Column(Numeric(19, 4), nullable=False)
    status = Column(String(20), nullable=False, default="SETTLED")
    execution_fx_rate = Column(Numeric(19, 4), nullable=True)
    portfolio_amount = Column(Numeric(19, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")

    __table_args__ = (
        CheckConstraint("transaction_type IN ('BUY','SELL')", name="transactions_type_check"),
        CheckConstraint("quantity > 0", name="transactions_quantity_check"),
        CheckConstraint("price >= 0", name="transactions_price_check"),
        CheckConstraint("fx_rate IS NULL OR fx_rate > 0", name="transactions_fx_rate_check"),
        CheckConstraint("portfolio_amount >= 0", name="transactions_portfolio_amount_check"),
    )

    # Relationships
    portfolio = relationship("Portfolio", back_populates="transactions")