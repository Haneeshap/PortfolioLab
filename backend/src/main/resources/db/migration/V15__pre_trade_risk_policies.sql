-- PortfolioLab simulated pre-trade policies. Defaults are intentionally permissive for existing demo balances.
CREATE TABLE pre_trade_risk_policies (
 portfolio_id BIGINT PRIMARY KEY REFERENCES portfolios(id) ON DELETE CASCADE,
 max_order_value NUMERIC(19,4) NOT NULL DEFAULT 50000 CHECK (max_order_value > 0),
 max_position_pct NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (max_position_pct > 0 AND max_position_pct <= 100),
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO pre_trade_risk_policies(portfolio_id)
 SELECT id FROM portfolios ON CONFLICT (portfolio_id) DO NOTHING;
