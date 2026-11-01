# PortfolioLab Models - History Candles
# Mirrors market candlestick data (similar to market_price_samples)

from sqlalchemy import BigInteger, CheckConstraint, Column, Numeric, String, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class HistoryCandle(Base):
    """Mirrors market candlestick/history candle data.

    Stores OHLCV data at various timeframes for technical analysis.
    """

    __tablename__ = "history_candles"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False)
    currency = Column(String(3), nullable=False)
    timeframe = Column(String(10), nullable=False)  # 1m, 5m, 15m, 1h, 4h, 1d
    open_price = Column(Numeric(19, 4), nullable=False)
    high_price = Column(Numeric(19, 4), nullable=False)
    low_price = Column(Numeric(19, 4), nullable=False)
    close_price = Column(Numeric(19, 4), nullable=False)
    volume = Column(Numeric(19, 6), nullable=False, default=0)
    observed_at = Column(DateTime(timezone=True), nullable=False, server_default="CURRENT_TIMESTAMP")

    __table_args__ = (
        CheckConstraint("open_price > 0", name="history_candle_open_check"),
        CheckConstraint("high_price > 0", name="history_candle_high_check"),
        CheckConstraint("low_price > 0", name="history_candle_low_check"),
        CheckConstraint("close_price > 0", name="history_candle_close_check"),
        CheckConstraint("volume >= 0", name="history_candle_volume_check"),
        CheckConstraint(
            "timeframe IN ('1m','5m','15m','1h','4h','1d')",
            name="history_candle_timeframe_check",
        ),
    )

    # Relationships