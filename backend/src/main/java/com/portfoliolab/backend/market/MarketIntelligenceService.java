package com.portfoliolab.backend.market;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class MarketIntelligenceService {
 private static final Logger log=LoggerFactory.getLogger(MarketIntelligenceService.class);
 private final JdbcTemplate jdbc;
 private final MarketService market;
 private final ObjectMapper mapper;
 private final TransactionTemplate tx;
 public MarketIntelligenceService(JdbcTemplate jdbc, MarketService market, ObjectMapper mapper, PlatformTransactionManager manager) {
  this.jdbc=jdbc; this.market=market; this.mapper=mapper; this.tx=new TransactionTemplate(manager);
 }
 public record IntelligenceEvent(long id,String symbol,String currency,String eventType,int windowSeconds,
  BigDecimal startPrice,BigDecimal endPrice,BigDecimal changePercent,String headline,String explanation,Instant createdAt) {}
 private final org.springframework.jdbc.core.RowMapper<IntelligenceEvent> row=(rs,n)->new IntelligenceEvent(
  rs.getLong("id"),rs.getString("symbol"),rs.getString("currency"),rs.getString("event_type"),
  rs.getInt("window_seconds"),rs.getBigDecimal("start_price"),rs.getBigDecimal("end_price"),
  rs.getBigDecimal("change_percent"),rs.getString("headline"),rs.getString("explanation"),
  rs.getTimestamp("created_at").toInstant());

 public List<IntelligenceEvent> feed(long portfolioId,String scope,String type,int requestedLimit) {
  Integer exists=jdbc.queryForObject("SELECT count(*) FROM portfolios WHERE id=?",Integer.class,portfolioId);
  if(exists==null||exists==0) throw new IllegalArgumentException("Portfolio not found");
  String s=scope==null?"all":scope.toLowerCase(Locale.ROOT);
  String t=type==null?"all":type.toUpperCase(Locale.ROOT);
  if(!List.of("all","watchlist").contains(s)) throw new IllegalArgumentException("Invalid scope");
  if(!List.of("ALL","SURGE","DROP").contains(t)) throw new IllegalArgumentException("Invalid event type");
  int limit=Math.min(100,Math.max(1,requestedLimit));
  return jdbc.query("""
   SELECT e.* FROM market_intelligence_events e
   WHERE (?='ALL' OR e.event_type=?)
   AND (?='all' OR EXISTS (
    SELECT 1 FROM watchlists w JOIN watchlist_items wi ON wi.watchlist_id=w.id
    JOIN assets a ON a.id=wi.asset_id
    WHERE w.portfolio_id=? AND a.symbol=e.symbol))
   ORDER BY e.created_at DESC,e.id DESC LIMIT ?
   """,row,t,t,s,portfolioId,limit);
 }

 @Scheduled(fixedDelay=5000,initialDelay=12000)
 public void observe() {
  List<MarketPrice> quotes;
  try {quotes=market.getCurrentPrices();} catch(Exception e){return;}
  try {
   tx.executeWithoutResult(status->{
    for(MarketPrice q:quotes){
     if(q.price()==null||q.price().signum()<=0||q.symbol()==null||q.currency()==null)continue;
     BigDecimal current=q.price().setScale(4,RoundingMode.HALF_UP);
     // One coherent DB observation batch, rather than independent browser polling.
     jdbc.update("INSERT INTO market_price_samples(symbol,currency,price) VALUES(?,?,?)",q.symbol(),q.currency(),current);
     check(q.symbol(),q.currency(),current,60,new BigDecimal("3.0"));
     check(q.symbol(),q.currency(),current,300,new BigDecimal("6.0"));
    }
   });
  } catch(Exception e){log.warn("Market intelligence observation failed",e);}
 }
 private void check(String symbol,String currency,BigDecimal current,int seconds,BigDecimal threshold){
  // Nearest sample around the beginning of the window (±15s).
  List<BigDecimal> candidates=jdbc.query("""
   SELECT price FROM market_price_samples WHERE symbol=? AND currency=?
   AND observed_at BETWEEN NOW() - (? * INTERVAL '1 second') - INTERVAL '15 seconds'
                       AND NOW() - (? * INTERVAL '1 second') + INTERVAL '15 seconds'
   ORDER BY ABS(EXTRACT(EPOCH FROM (observed_at-(NOW()-(? * INTERVAL '1 second'))))) ASC,id ASC LIMIT 1
   """,(rs,n)->rs.getBigDecimal(1),symbol,currency,seconds,seconds,seconds);
  if(candidates.isEmpty()||candidates.get(0).signum()<=0)return;
  BigDecimal start=candidates.get(0);
  BigDecimal percent=current.subtract(start).multiply(new BigDecimal("100"))
    .divide(start,4,RoundingMode.HALF_UP);
  if(percent.abs().compareTo(threshold)<0)return;
  String type=percent.signum()>0?"SURGE":"DROP";
  // Suppress repeats across observation windows for the same asset/direction.
  Integer recent=jdbc.queryForObject("""
   SELECT count(*) FROM market_intelligence_events WHERE symbol=? AND event_type=?
   AND created_at > NOW()-INTERVAL '10 minutes'
   """,Integer.class,symbol,type);
  if(recent!=null&&recent>0)return;
  String window=seconds==60?"1 minute":"5 minutes";
  String headline=symbol+(percent.signum()>0?" rises sharply":" falls sharply")+" in simulated trading";
  String explanation=String.format(Locale.ROOT,
   "%s moved %s%% over %s, from %s to %s %s. Flagged because the absolute move exceeded %s%%. All prices are simulated.",
   symbol,percent.toPlainString(),window,start.toPlainString(),current.toPlainString(),currency,threshold.toPlainString());
  Long id=jdbc.queryForObject("""
   INSERT INTO market_intelligence_events(symbol,currency,event_type,window_seconds,start_price,end_price,change_percent,headline,explanation)
   VALUES(?,?,?,?,?,?,?,?,?) RETURNING id
   """,Long.class,symbol,currency,type,seconds,start,current,percent,headline,explanation);
  try {
   String payload=mapper.writeValueAsString(Map.of("eventType","MARKET_INTELLIGENCE","intelligenceId",id,
    "symbol",symbol,"currency",currency,"direction",type,"windowSeconds",seconds,
    "changePercent",percent,"headline",headline,"explanation",explanation));
   jdbc.update("INSERT INTO market_intelligence_outbox(intelligence_id,payload) VALUES(?,?)",id,payload);
  } catch(Exception e){throw new IllegalStateException("Unable to serialize market intelligence event",e);}
 }
 @Scheduled(fixedDelay=3600000,initialDelay=3600000)
 public void pruneSamples(){jdbc.update("DELETE FROM market_price_samples WHERE observed_at < NOW()-INTERVAL '24 hours'");}
}
