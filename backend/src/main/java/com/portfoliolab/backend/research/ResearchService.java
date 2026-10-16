package com.portfoliolab.backend.research;
import com.portfoliolab.backend.asset.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
@Service
public class ResearchService {
 private final AssetRepository assets;private final ResearchHistoryStore history;
 public ResearchService(AssetRepository assets,ResearchHistoryStore history){this.assets=assets;this.history=history;}
 public record Bar(ResearchHistoryStore.Candle candle,ResearchMath.Point indicators){}
 public record Summary(java.math.BigDecimal firstClose,java.math.BigDecimal lastClose,java.math.BigDecimal change,java.math.BigDecimal changePct,int observations){}
 public record Result(long assetId,String symbol,String currency,String source,String interval,LocalDate from,LocalDate to,int period,int expectedDays,int missingDays,List<String>warnings,List<Bar> bars,Summary summary,String methodology){}
 public static void validateRange(LocalDate from,LocalDate to){if(from==null||to==null||from.isBefore(LocalDate.of(2025,1,1))||!to.isAfter(from)||to.isAfter(LocalDate.now(ZoneOffset.UTC))||ChronoUnit.DAYS.between(from,to)>366)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use completed UTC days since 2025-01-01; exclusive to; maximum 366 days");}
 public Result research(long id,LocalDate from,LocalDate to,int period){
  validateRange(from,to);if(period<2||period>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"period must be 2..100");
  Asset asset=assets.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Fictional asset not found"));
  List<String>warnings=new ArrayList<>();var rows=history.read(id,from,to);int expected=(int)ChronoUnit.DAYS.between(from,to);
  if(rows.size()!=expected){try{history.ingest(id,asset.getSymbol(),from,to);}catch(Exception ex){warnings.add("Fixture service unavailable or invalid; missing candles are not fabricated");}rows=history.read(id,from,to);}
  List<Bar> bars=new ArrayList<>();List<Double> contiguous=new ArrayList<>();Instant previous=null;
  for(var c:rows){if(previous!=null&&!c.time().equals(previous.plus(1,ChronoUnit.DAYS)))contiguous.clear();contiguous.add(c.close().doubleValue());var points=ResearchMath.indicators(contiguous,period);bars.add(new Bar(c,points.getLast()));previous=c.time();}
  if(rows.size()!=expected)warnings.add("Incomplete history; indicator warm-up restarts after each gap");
  return new Result(id,asset.getSymbol(),asset.getCurrency(),"fictional-history-v1","1d",from,to,period,expected,expected-rows.size(),warnings,bars,rows.isEmpty()?new Summary(null,null,null,null,0):new Summary(rows.getFirst().close(),rows.getLast().close(),rows.getLast().close().subtract(rows.getFirst().close()),rows.getLast().close().subtract(rows.getFirst().close()).multiply(java.math.BigDecimal.valueOf(100)).divide(rows.getFirst().close(),4,java.math.RoundingMode.HALF_UP),rows.size()),"Generated fictional daily fixtures, independent of live quotes. SMA arithmetic mean; EMA seeded by SMA, alpha=2/(n+1); Wilder RSI (flat=50); sample SD of n log returns annualized sqrt(365). UTC continuous days; no trading signal guarantees.");
 }
}
