-- Actual observed prices cannot be reconstructed from generated OHLCV fixtures.
-- Legacy snapshots remain untouched and explicitly unverified.
ALTER TABLE portfolio_snapshots ADD COLUMN positions_verified BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE portfolio_snapshot_positions (
 snapshot_id BIGINT NOT NULL REFERENCES portfolio_snapshots(id) ON DELETE CASCADE,
 asset_id BIGINT NOT NULL REFERENCES assets(id),
 quantity NUMERIC(19,6) NOT NULL CHECK(quantity>0),
 price NUMERIC(19,4) NOT NULL CHECK(price>0),
 quote_time TIMESTAMPTZ NOT NULL,
 market_value NUMERIC(25,8) NOT NULL,
 PRIMARY KEY(snapshot_id,asset_id)
);
CREATE INDEX idx_dividend_payments_portfolio_time ON simulated_dividend_payments(portfolio_id,created_at);
