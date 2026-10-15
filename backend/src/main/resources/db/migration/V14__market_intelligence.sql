-- Simulated market observations and durable, deduplicated intelligence events.
CREATE TABLE market_price_samples (
 id BIGSERIAL PRIMARY KEY, symbol VARCHAR(20) NOT NULL,
 currency VARCHAR(3) NOT NULL, price NUMERIC(19,4) NOT NULL CHECK(price>0),
 observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX market_price_samples_lookup ON market_price_samples(symbol, observed_at DESC);
CREATE TABLE market_intelligence_events (
 id BIGSERIAL PRIMARY KEY, symbol VARCHAR(20) NOT NULL,
 currency VARCHAR(3) NOT NULL, event_type VARCHAR(30) NOT NULL,
 window_seconds INTEGER NOT NULL, start_price NUMERIC(19,4) NOT NULL,
 end_price NUMERIC(19,4) NOT NULL, change_percent NUMERIC(12,4) NOT NULL,
 headline VARCHAR(220) NOT NULL, explanation TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX market_intelligence_events_latest ON market_intelligence_events(created_at DESC,id DESC);
CREATE INDEX market_intelligence_events_cooldown ON market_intelligence_events(symbol,event_type,created_at DESC);
CREATE TABLE market_intelligence_outbox (
 event_id BIGSERIAL PRIMARY KEY,
 intelligence_id BIGINT NOT NULL UNIQUE REFERENCES market_intelligence_events(id) ON DELETE CASCADE,
 payload TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 published_at TIMESTAMPTZ
);
CREATE INDEX market_intelligence_outbox_pending ON market_intelligence_outbox(created_at,event_id) WHERE published_at IS NULL;
