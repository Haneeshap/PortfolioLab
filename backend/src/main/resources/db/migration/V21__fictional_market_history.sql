CREATE TABLE fictional_market_candles (
 asset_id BIGINT NOT NULL REFERENCES assets(id),
 candle_time TIMESTAMPTZ NOT NULL,
 interval_code VARCHAR(2) NOT NULL CHECK(interval_code='1d'),
 source VARCHAR(40) NOT NULL CHECK(source='fictional-history-v1'),
 open NUMERIC(19,4) NOT NULL CHECK(open>0),
 high NUMERIC(19,4) NOT NULL,
 low NUMERIC(19,4) NOT NULL CHECK(low>0),
 close NUMERIC(19,4) NOT NULL CHECK(close>0),
 volume BIGINT NOT NULL CHECK(volume>=0),
 PRIMARY KEY(asset_id,interval_code,candle_time),
 CHECK(high>=open AND high>=close AND low<=open AND low<=close AND high>=low),
 CHECK(candle_time = date_trunc('day',candle_time AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
);
COMMENT ON TABLE fictional_market_candles IS 'Generated fictional-history-v1 fixtures, not recorded market history or live OMS quotes';
