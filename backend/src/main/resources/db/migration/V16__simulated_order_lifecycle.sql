-- M31 phase 1: durable simulated order lifecycle. No changes to legacy transactions.
CREATE TABLE simulated_orders (
 id BIGSERIAL PRIMARY KEY,
 portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
 asset_id BIGINT NOT NULL REFERENCES assets(id),
 side VARCHAR(4) NOT NULL CHECK (side IN ('BUY','SELL')),
 requested_quantity NUMERIC(19,6) NOT NULL CHECK (requested_quantity > 0),
 filled_quantity NUMERIC(19,6) NOT NULL DEFAULT 0 CHECK (filled_quantity >= 0),
 status VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED','FILLED','REJECTED','CANCELLED')),
 failure_reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (filled_quantity <= requested_quantity),
 CHECK (status <> 'FILLED' OR filled_quantity = requested_quantity),
 CHECK (status <> 'PARTIALLY_FILLED' OR (filled_quantity > 0 AND filled_quantity < requested_quantity))
);
CREATE INDEX idx_simulated_orders_portfolio ON simulated_orders(portfolio_id,created_at DESC,id DESC);
CREATE INDEX idx_simulated_orders_pending ON simulated_orders(id) WHERE status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED');
CREATE TABLE simulated_order_fills (
 id BIGSERIAL PRIMARY KEY,
 order_id BIGINT NOT NULL REFERENCES simulated_orders(id),
 transaction_id BIGINT NOT NULL UNIQUE REFERENCES transactions(id),
 fill_sequence INTEGER NOT NULL CHECK (fill_sequence > 0),
 quantity NUMERIC(19,6) NOT NULL CHECK (quantity > 0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(order_id,fill_sequence)
);
