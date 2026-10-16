CREATE TABLE notification_preferences (
 portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
 event_type VARCHAR(80) NOT NULL CHECK(event_type IN ('ORDER_FILLED','ORDER_PARTIALLY_FILLED','ORDER_CANCELLED','ORDER_EXPIRED','PRICE_ALERT','TRADE_EXECUTED','DIVIDEND_CREDITED','AGENT_INSIGHT')),
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY(portfolio_id,event_type)
);
-- Keep deduplication receipts independently of notification retention and preferences.
CREATE TABLE notification_receipts(event_id UUID PRIMARY KEY, processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO notification_receipts(event_id) SELECT event_id FROM notifications;
CREATE INDEX idx_notifications_unread ON notifications(portfolio_id,id) WHERE read_at IS NULL;
CREATE FUNCTION enqueue_order_notification() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE event_uuid UUID;
BEGIN
 IF NEW.status IN ('FILLED','PARTIALLY_FILLED','CANCELLED','EXPIRED') THEN
  event_uuid := md5('order-event:' || NEW.id::text)::uuid;
  INSERT INTO notification_outbox(event_id,event_type,portfolio_id,payload)
  VALUES(event_uuid,'ORDER_' || NEW.status,NEW.portfolio_id,
   json_build_object('eventId',event_uuid,'eventType','ORDER_' || NEW.status,
    'portfolioId',NEW.portfolio_id,'title','Simulated order ' || lower(replace(NEW.status,'_',' ')),
    'message','Order #' || NEW.order_id || ': ' || NEW.filled_quantity || ' of ' || NEW.requested_quantity || ' units filled.',
    'targetUrl','/portfolio?orderId=' || NEW.order_id)::text);
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER order_notification AFTER INSERT ON simulated_order_events FOR EACH ROW EXECUTE FUNCTION enqueue_order_notification();
