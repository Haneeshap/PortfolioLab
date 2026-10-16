-- No historical balances, fills or order statuses are rewritten.
ALTER TABLE simulated_orders ADD COLUMN reservation_managed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE simulated_orders ADD COLUMN reserved_cash NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK(reserved_cash>=0);
ALTER TABLE simulated_orders ADD COLUMN reserved_shares NUMERIC(19,6) NOT NULL DEFAULT 0 CHECK(reserved_shares>=0);
ALTER TABLE simulated_orders ADD COLUMN cash_per_share NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK(cash_per_share>=0);
