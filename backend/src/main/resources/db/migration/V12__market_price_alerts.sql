CREATE TABLE market_price_alerts (
 id BIGSERIAL PRIMARY KEY,
 portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
 symbol VARCHAR(20) NOT NULL,
 currency VARCHAR(3) NOT NULL,
 direction VARCHAR(5) NOT NULL CHECK (direction IN ('ABOVE','BELOW')),
 target_price NUMERIC(19,4) NOT NULL CHECK (target_price > 0),
 last_price NUMERIC(19,4) NOT NULL CHECK (last_price > 0),
 status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','TRIGGERED','CANCELLED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 triggered_at TIMESTAMPTZ,
 CHECK ((status = 'TRIGGERED') = (triggered_at IS NOT NULL))
);
CREATE INDEX idx_market_price_alerts_active ON market_price_alerts(status, symbol);
CREATE INDEX idx_market_price_alerts_portfolio ON market_price_alerts(portfolio_id, created_at DESC);
