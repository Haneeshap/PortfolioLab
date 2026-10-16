-- Existing records retain their original market execution semantics.
ALTER TABLE simulated_orders ADD COLUMN order_type VARCHAR(6) NOT NULL DEFAULT 'MARKET' CHECK(order_type IN ('MARKET','LIMIT'));
ALTER TABLE simulated_orders ADD COLUMN limit_price NUMERIC(19,4);
ALTER TABLE simulated_orders ADD COLUMN time_in_force VARCHAR(3) NOT NULL DEFAULT 'GTC' CHECK(time_in_force IN ('DAY','GTC'));
ALTER TABLE simulated_orders ADD COLUMN expires_at TIMESTAMPTZ;
ALTER TABLE simulated_orders ADD CONSTRAINT valid_limit CHECK ((order_type='MARKET' AND limit_price IS NULL) OR (order_type='LIMIT' AND limit_price IS NOT NULL AND limit_price>0));
ALTER TABLE simulated_orders DROP CONSTRAINT simulated_orders_status_check;
ALTER TABLE simulated_orders ADD CONSTRAINT simulated_orders_status_check CHECK(status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED','FILLED','REJECTED','CANCELLED','EXPIRED'));
