"""Asset domain model mirroring the Java ``Asset`` entity and ``assets`` table."""

from sqlalchemy import BigInteger, CheckConstraint, Column, Numeric, String

from app.core.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, unique=True, index=True)
    name = Column(String(150), nullable=False)
    price = Column(Numeric(19, 4), nullable=False)
    currency = Column(String(3), nullable=False)
    sector = Column(String(100), nullable=True)
    description = Column(String(1000), nullable=True)

    __table_args__ = (
        CheckConstraint("price >= 0", name="assets_price_check"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Asset(id={self.id}, symbol={self.symbol!r}, name={self.name!r})>"
