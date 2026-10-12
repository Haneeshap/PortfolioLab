CREATE TABLE portfolio_snapshots (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cash_balance NUMERIC(19,4) NOT NULL,
    holdings_value NUMERIC(19,4) NOT NULL,
    total_value NUMERIC(19,4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    valuation_source VARCHAR(30) NOT NULL
);

CREATE INDEX idx_portfolio_snapshots_history
    ON portfolio_snapshots(portfolio_id, captured_at DESC, id DESC);
