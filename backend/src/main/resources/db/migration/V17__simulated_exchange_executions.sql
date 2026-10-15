-- M31 Phase 2: execution receipts; one transaction per simulated fill.
CREATE TABLE simulated_exchange_executions (
 id BIGSERIAL PRIMARY KEY,
 order_id BIGINT NOT NULL REFERENCES simulated_orders(id),
 execution_ref VARCHAR(100) NOT NULL UNIQUE,
 fill_sequence INTEGER NOT NULL CHECK(fill_sequence > 0),
 transaction_id BIGINT NOT NULL UNIQUE REFERENCES transactions(id),
 quantity NUMERIC(19,6) NOT NULL CHECK(quantity > 0),
 price_per_unit NUMERIC(19,4) NOT NULL CHECK(price_per_unit > 0),
 executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(order_id,fill_sequence)
);
CREATE INDEX idx_simulated_exchange_executions_order ON simulated_exchange_executions(order_id,id);
