"""asset_vector_search

Port of Flyway V24__asset_vector_search.sql to Alembic.

Idempotent: safe to run when the pgvector extension, assets.description
column, asset_search_embeddings table or HNSW index already exist (which they
do when this Python backend is pointed at the same database the Java backend
migrated with Flyway).

Down revision: orders (completes the squashed 5-migration chain:
initial -> auth -> portfolios -> orders -> vector_extension).
"""

from alembic import op

revision = "0001_asset_vector_search"
down_revision = "orders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("ALTER TABLE assets ADD COLUMN IF NOT EXISTS description TEXT")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS asset_search_embeddings (
            id BIGSERIAL PRIMARY KEY,
            asset_id BIGINT NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            embedding vector(768) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS asset_search_embeddings_hnsw
        ON asset_search_embeddings USING hnsw (embedding vector_cosine_ops)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS asset_search_embeddings_hnsw")
    op.execute("DROP TABLE IF EXISTS asset_search_embeddings")