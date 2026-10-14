CREATE TABLE notification_outbox (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(80) NOT NULL,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_notification_outbox_pending
    ON notification_outbox (created_at, event_id)
    WHERE published_at IS NULL;

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
    source VARCHAR(80) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    target_url VARCHAR(300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_portfolio_created
    ON notifications (portfolio_id, created_at DESC, id DESC);