CREATE TABLE fx_rates (
    id BIGSERIAL PRIMARY KEY,
    base_currency VARCHAR(3) NOT NULL,
    quote_currency VARCHAR(3) NOT NULL,
    rate NUMERIC(19, 8) NOT NULL,
    source VARCHAR(30) NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_fx_base_currency
        CHECK (base_currency ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_fx_quote_currency
        CHECK (quote_currency ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_fx_distinct_currencies
        CHECK (base_currency <> quote_currency),

    CONSTRAINT chk_fx_positive_rate
        CHECK (rate > 0)
);

CREATE INDEX idx_fx_rates_pair_history
    ON fx_rates (
        base_currency,
        quote_currency,
        captured_at DESC,
        id DESC
    );

INSERT INTO fx_rates (
    base_currency,
    quote_currency,
    rate,
    source
)
VALUES
    ('USD', 'INR', 85.00000000, 'SIMULATED'),
    ('EUR', 'INR', 92.00000000, 'SIMULATED');