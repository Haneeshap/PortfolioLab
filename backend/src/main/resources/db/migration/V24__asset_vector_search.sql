-- Semantic (vector) search over assets using pgvector (PostgreSQL 17).
-- Enables natural-language queries to match assets by meaning, not exact symbol/name.
-- Read-only and educational; no trading side effects.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE assets ADD COLUMN IF NOT EXISTS description TEXT;

-- Backfill human-readable descriptions for seeded/demo assets so embedding content is meaningful.
UPDATE assets SET description = 'Demo reference asset used for onboarding and tutorials.' WHERE symbol = 'DEMO';
UPDATE assets SET description = 'Technology growth stock focused on cloud and AI infrastructure.' WHERE symbol = 'NOVA';
UPDATE assets SET description = 'Renewable energy and clean technology company in the power sector.' WHERE symbol = 'GREEN';
UPDATE assets SET description = 'Orbital logistics and satellite communications aerospace firm.' WHERE symbol = 'ORBIT';
UPDATE assets SET description = 'Early-stage alpha-seeking equities research asset.' WHERE symbol = 'ALPHA';

CREATE TABLE asset_search_embeddings (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX asset_search_embeddings_hnsw
    ON asset_search_embeddings USING hnsw (embedding vector_cosine_ops);