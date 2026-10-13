ALTER TABLE transactions
    ADD COLUMN execution_fx_rate NUMERIC(19, 8);

ALTER TABLE transactions
    ADD COLUMN portfolio_amount NUMERIC(19, 4);

UPDATE transactions
SET execution_fx_rate = 1,
    portfolio_amount = total_amount;

ALTER TABLE transactions
    ALTER COLUMN execution_fx_rate SET NOT NULL,
    ALTER COLUMN portfolio_amount SET NOT NULL;

ALTER TABLE transactions
    ADD CONSTRAINT chk_transaction_fx_rate_positive
    CHECK (execution_fx_rate > 0);

ALTER TABLE transactions
    ADD CONSTRAINT chk_transaction_portfolio_amount_nonnegative
    CHECK (portfolio_amount >= 0);