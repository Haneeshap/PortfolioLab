-- Transactional event journal: rolled-back order changes cannot be streamed.
CREATE TABLE simulated_order_events (
 id BIGSERIAL PRIMARY KEY,
 portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
 order_id BIGINT NOT NULL REFERENCES simulated_orders(id),
 status VARCHAR(24) NOT NULL,
 requested_quantity NUMERIC(19,6) NOT NULL,
 filled_quantity NUMERIC(19,6) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_events_portfolio_cursor ON simulated_order_events(portfolio_id,id);
CREATE FUNCTION record_simulated_order_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO simulated_order_events(portfolio_id,order_id,status,requested_quantity,filled_quantity)
  VALUES(NEW.portfolio_id,NEW.id,NEW.status,NEW.requested_quantity,NEW.filled_quantity);
 ELSIF OLD.status IS DISTINCT FROM NEW.status OR OLD.filled_quantity IS DISTINCT FROM NEW.filled_quantity THEN
  INSERT INTO simulated_order_events(portfolio_id,order_id,status,requested_quantity,filled_quantity)
  VALUES(NEW.portfolio_id,NEW.id,NEW.status,NEW.requested_quantity,NEW.filled_quantity);
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER simulated_order_event AFTER INSERT OR UPDATE ON simulated_orders FOR EACH ROW EXECUTE FUNCTION record_simulated_order_event();
