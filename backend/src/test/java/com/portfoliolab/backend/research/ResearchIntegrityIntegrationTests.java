package com.portfoliolab.backend.research;
import org.junit.jupiter.api.Test;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.boot.test.context.SpringBootTest;import org.springframework.test.context.bean.override.mockito.MockitoBean;import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.transaction.annotation.Transactional;import java.math.*;import java.time.*;import java.util.*;import com.portfoliolab.backend.market.*;import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;
@SpringBootTest(properties={"oms.worker.initial-delay=3600000"})
@Transactional
class ResearchIntegrityIntegrationTests {
 @Autowired JdbcTemplate jdbc;@Autowired RiskLabService risk;@Autowired ResearchService research;
 @MockitoBean MarketService market;
 @MockitoBean com.portfoliolab.backend.history.PortfolioHistoryRecorder history;
 @MockitoBean com.portfoliolab.backend.notification.NotificationOutboxPublisher notifications;
 @MockitoBean com.portfoliolab.backend.notification.MarketIntelligenceOutboxPublisher publisher;
 @MockitoBean com.portfoliolab.backend.market.PriceAlertService alerts;
 @MockitoBean com.portfoliolab.backend.market.MarketIntelligenceService intelligence;
 @MockitoBean com.portfoliolab.backend.dividend.ScheduledDividendScheduler dividends;
 @MockitoBean com.portfoliolab.backend.risk.PortfolioTradeRiskListener listener;
 String fingerprint(){return jdbc.queryForObject("SELECT md5(concat((SELECT json_agg(p ORDER BY id)::text FROM portfolios p),(SELECT json_agg(h ORDER BY id)::text FROM holdings h),(SELECT json_agg(o ORDER BY id)::text FROM simulated_orders o),(SELECT json_agg(t ORDER BY id)::text FROM transactions t),(SELECT json_agg(e ORDER BY id)::text FROM simulated_exchange_executions e),(SELECT json_agg(f ORDER BY id)::text FROM simulated_order_fills f),(SELECT json_agg(c ORDER BY asset_id,candle_time)::text FROM fictional_market_candles c)))",String.class);}
 @Test void scenariosDoNotMutateAnyFinancialOrHistoryEvidence(){var quotes=jdbc.query("SELECT symbol,price,currency FROM assets",(rs,n)->new MarketPrice(rs.getString(1),rs.getBigDecimal(2),rs.getString(3),Instant.now()));when(market.getCurrentPrices()).thenReturn(quotes);String before=fingerprint();var first=risk.evaluate(1,new RiskLabService.Scenario(new BigDecimal("-10"),Map.of()));var second=risk.evaluate(1,new RiskLabService.Scenario(new BigDecimal("10"),Map.of()));assertEquals(1,first.portfolioId());assertTrue(first.hypothetical());assertEquals(before,fingerprint());assertNotNull(second);}
 @Test void historyCacheQueryLeavesOmsUntouched(){long asset=jdbc.queryForObject("SELECT id FROM assets ORDER BY id LIMIT 1",Long.class);for(int day=1;day<=2;day++)jdbc.update("INSERT INTO fictional_market_candles(asset_id,candle_time,interval_code,source,open,high,low,close,volume) VALUES(?,?,'1d','fictional-history-v1',100,110,90,105,1000) ON CONFLICT DO NOTHING",asset,java.sql.Timestamp.from(LocalDate.of(2025,1,day).atStartOfDay(ZoneOffset.UTC).toInstant()));String before=fingerprint();var r=research.research(asset,LocalDate.of(2025,1,1),LocalDate.of(2025,1,3),2);assertEquals(0,r.missingDays());assertEquals(2,r.bars().size());assertEquals(before,fingerprint());}
}
