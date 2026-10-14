CREATE TABLE simulated_dividend_schedules (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES assets(id),
    reference_key VARCHAR(120) NOT NULL UNIQUE,
    dividend_per_share NUMERIC(19,4) NOT NULL CHECK (dividend_per_share > 0),
    currency VARCHAR(3) NOT NULL,
    record_cutoff TIMESTAMPTZ NOT NULL,
    payment_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (payment_at > record_cutoff)
);

CREATE TABLE simulated_scheduled_dividend_payments (
    id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES simulated_dividend_schedules(id),
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
    eligible_shares NUMERIC(19,6) NOT NULL CHECK (eligible_shares > 0),
    amount NUMERIC(19,4) NOT NULL CHECK (amount > 0),
    credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (schedule_id, portfolio_id)
);
CREATE INDEX idx_simulated_dividend_schedules_due ON simulated_dividend_schedules(payment_at);
