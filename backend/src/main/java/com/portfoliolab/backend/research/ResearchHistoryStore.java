package com.portfoliolab.backend.research;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
@Service
public class ResearchHistoryStore {
 public record Candle(Instant time,BigDecimal open,BigDecimal high,BigDecimal low,BigDecimal close,long volume){}
 public record Fixture(String symbol,String source,String interval,List<Candle> candles){}
 private final JdbcTemplate jdbc;
 private final RestClient go;
 @org.springframework.beans.factory.annotation.Autowired
 public ResearchHistoryStore(JdbcTemplate jdbc){this(jdbc,defaultClient());}
 ResearchHistoryStore(JdbcTemplate jdbc,RestClient client){this.jdbc=jdbc;this.go=client;}
 private static RestClient defaultClient(){var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();factory.setConnectTimeout(3000);factory.setReadTimeout(5000);return RestClient.builder().baseUrl("http://127.0.0.1:8081").requestFactory(factory).build();}
 @Transactional(readOnly=true)
 public List<Candle> read(long assetId,LocalDate from,LocalDate to){
  return jdbc.query("SELECT * FROM fictional_market_candles WHERE asset_id=? AND interval_code='1d' AND candle_time>=? AND candle_time<? ORDER BY candle_time LIMIT 366",(rs,n)->new Candle(rs.getTimestamp("candle_time").toInstant(),rs.getBigDecimal("open"),rs.getBigDecimal("high"),rs.getBigDecimal("low"),rs.getBigDecimal("close"),rs.getLong("volume")),assetId,java.sql.Timestamp.from(from.atStartOfDay(ZoneOffset.UTC).toInstant()),java.sql.Timestamp.from(to.atStartOfDay(ZoneOffset.UTC).toInstant()));
 }
 @Transactional
 public void ingest(long assetId,String symbol,LocalDate from,LocalDate to){
  Fixture fixture=go.get().uri(b->b.path("/history").queryParam("symbol",symbol).queryParam("from",from).queryParam("to",to).build()).retrieve().body(Fixture.class);
  if(fixture==null||!symbol.equals(fixture.symbol())||!"fictional-history-v1".equals(fixture.source())||!"1d".equals(fixture.interval())||fixture.candles()==null||fixture.candles().size()!=java.time.temporal.ChronoUnit.DAYS.between(from,to))throw new IllegalStateException("Incomplete fictional fixture response");
  LocalDate expected=from;
  for(Candle c:fixture.candles()){
   if(c.time()==null||!c.time().equals(expected.atStartOfDay(ZoneOffset.UTC).toInstant())||c.open()==null||c.close()==null||c.high()==null||c.low()==null||c.open().signum()<=0||c.close().signum()<=0||c.low().signum()<=0||c.high().compareTo(c.open().max(c.close()))<0||c.low().compareTo(c.open().min(c.close()))>0||c.volume()<0)throw new IllegalStateException("Invalid fixture candle");
   jdbc.update("INSERT INTO fictional_market_candles(asset_id,candle_time,interval_code,source,open,high,low,close,volume) VALUES(?,?,'1d','fictional-history-v1',?,?,?,?,?) ON CONFLICT DO NOTHING",assetId,java.sql.Timestamp.from(c.time()),c.open(),c.high(),c.low(),c.close(),c.volume());expected=expected.plusDays(1);
  }
 }
}
