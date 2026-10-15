-- Milestone 28: fictional stock universe and persistent watchlists
ALTER TABLE assets ADD COLUMN IF NOT EXISTS sector VARCHAR(60);
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('NEXUS','Nexus Digital Systems',1245,'INR','Technology') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('QUANT','Quantix Computing',2180,'INR','Technology') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('CYBER','CyberPeak Security',875,'INR','Technology') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('CLOUD','Cloudspire Technologies',1560,'INR','Technology') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('FINIX','Finix Financial Services',640,'INR','Finance') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('VAULT','Vaultstone Banking',1120,'INR','Finance') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('CREDO','Credora Lending',425,'INR','Finance') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('PAYGO','Paygo Digital Payments',310,'INR','Finance') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('TRUST','Trustwell Capital',1780,'INR','Finance') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('SOLAR','Solara Renewables',485,'INR','Energy') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('VOLT','VoltEdge Energy',725,'INR','Energy') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('HYDRO','HydroNova Power',365,'INR','Energy') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('STEEL','SteelForge Industries',920,'INR','Industrial') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('METRO','Metroline Infrastructure',580,'INR','Industrial') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('MEDIX','Medix Healthcare',1340,'INR','Healthcare') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('BIOVA','Biova Life Sciences',765,'INR','Healthcare') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('CAREX','Carex Diagnostics',545,'INR','Healthcare') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('FRESH','Freshfield Foods',295,'INR','Consumer') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('URBAN','UrbanNest Retail',690,'INR','Consumer') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO assets(symbol,name,price,currency,sector) VALUES ('AURORA','Aurora Consumer Brands',1095,'INR','Consumer') ON CONFLICT (symbol) DO NOTHING;
CREATE TABLE watchlists (
 id BIGSERIAL PRIMARY KEY,
 portfolio_id BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
 name VARCHAR(80) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT watchlists_name_nonblank CHECK (length(btrim(name)) > 0),
 CONSTRAINT watchlists_unique_name UNIQUE (portfolio_id,name)
);
CREATE TABLE watchlist_items (
 watchlist_id BIGINT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
 asset_id BIGINT NOT NULL REFERENCES assets(id),
 added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (watchlist_id,asset_id)
);
CREATE INDEX watchlists_portfolio_idx ON watchlists(portfolio_id);
