CREATE TABLE portfolios (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cash_balance NUMERIC(19, 4) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_portfolio_cash_nonnegative
        CHECK (cash_balance >= 0),

    CONSTRAINT chk_portfolio_currency
        CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE holdings (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL,
    asset_id BIGINT NOT NULL,
    quantity NUMERIC(19, 6) NOT NULL,
    average_buy_price NUMERIC(19, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_holdings_portfolio
        FOREIGN KEY (portfolio_id)
        REFERENCES portfolios(id),

    CONSTRAINT fk_holdings_asset
        FOREIGN KEY (asset_id)
        REFERENCES assets(id),

    CONSTRAINT uq_portfolio_asset
        UNIQUE (portfolio_id, asset_id),

    CONSTRAINT chk_holding_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_holding_average_price
        CHECK (average_buy_price >= 0)
);

CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL,
    asset_id BIGINT NOT NULL,
    transaction_type VARCHAR(4) NOT NULL,
    quantity NUMERIC(19, 6) NOT NULL,
    price_per_unit NUMERIC(19, 4) NOT NULL,
    total_amount NUMERIC(19, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_transactions_portfolio
        FOREIGN KEY (portfolio_id)
        REFERENCES portfolios(id),

    CONSTRAINT fk_transactions_asset
        FOREIGN KEY (asset_id)
        REFERENCES assets(id),

    CONSTRAINT chk_transaction_type
        CHECK (transaction_type IN ('BUY', 'SELL')),

    CONSTRAINT chk_transaction_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_transaction_price
        CHECK (price_per_unit > 0),

    CONSTRAINT chk_transaction_total
        CHECK (total_amount > 0),

    CONSTRAINT chk_transaction_currency
        CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX idx_holdings_portfolio
    ON holdings(portfolio_id);

CREATE INDEX idx_transactions_portfolio_created
    ON transactions(portfolio_id, created_at DESC);