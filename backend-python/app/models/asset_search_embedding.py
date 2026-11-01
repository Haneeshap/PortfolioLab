"""Asset search embedding model mirroring Flyway V24__asset_vector_search.sql."""

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Column, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

from app.core.database import Base


class AssetSearchEmbedding(Base):
    __tablename__ = "asset_search_embeddings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    asset_id = Column(
        BigInteger,
        ForeignKey("assets.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=False)
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<AssetSearchEmbedding(id={self.id}, asset_id={self.asset_id})>"
