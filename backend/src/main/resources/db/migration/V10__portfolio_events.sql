CREATE TABLE simulated_dividend_payments (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
    asset_id BIGINT NOT NULL REFERENCES assets(id),
    reference_key VARCHAR(120) NOT NULL,
    eligible_shares NUMERIC(19, 6) NOT NULL CHECK (eligible_shares > 0),
    dividend_per_share NUMERIC(19, 4) NOT NULL CHECK (dividend_per_share > 0),
    amount NUMERIC(19, 4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (portfolio_id, reference_key)
);
CREATE TABLE portfolio_risk_insights (
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
    insight_key VARCHAR(160) NOT NULL,
    last_emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (portfolio_id, insight_key)
);