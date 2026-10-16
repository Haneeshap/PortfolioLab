package com.portfoliolab.backend.research;

import com.portfoliolab.backend.portfolio.*;
import com.portfoliolab.backend.market.*;
import java.math.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class RiskLabService {
 private final PortfolioRepository portfolios;private final PortfolioQueryService holdings;private final MarketService market;private final ResearchHistoryStore history;
 public RiskLabService(PortfolioRepository portfolios,PortfolioQueryService holdings,MarketService market,ResearchHistoryStore history){this.portfolios=portfolios;this.holdings=holdings;this.market=market;this.history=history;}
 public record Scenario(BigDecimal broadShockPct,Map<Long,BigDecimal> assetShocks){}
 public record Position(long assetId,String symbol,BigDecimal quantity,BigDecimal price,BigDecimal fxRate,BigDecimal marketValue,BigDecimal costBasis,BigDecimal unrealizedGainLoss,BigDecimal allocationPct,BigDecimal shockPct,BigDecimal projectedValue,BigDecimal impact){}
 public record Correlation(long firstAssetId,long secondAssetId,Double value,int observations){}
 public record Metrics(Double historicalVolatilityPct,Double maximumDrawdownPct,int observations,List<Correlation> correlations,String reason){}
 public record Result(long portfolioId,String currency,BigDecimal cash,BigDecimal marketValue,BigDecimal projectedValue,BigDecimal absoluteChange,BigDecimal percentageChange,BigDecimal cashAllocationPct,BigDecimal largestPositionPct,Double assetHhi,Double effectivePositions,BigDecimal unrealizedGainLoss,List<Position>positions,Metrics metrics,List<String>warnings,Scenario scenario,boolean hypothetical,boolean sectorsSupported,String methodology){}
 static BigDecimal money(BigDecimal n){return n.setScale(4,RoundingMode.HALF_UP);}
 static BigDecimal pct(BigDecimal n,BigDecimal d){return d.signum()==0?null:n.multiply(BigDecimal.valueOf(100)).divide(d,4,RoundingMode.HALF_UP);}
 static void shock(BigDecimal value){if(value==null||value.compareTo(new BigDecimal("-100"))<0||value.compareTo(new BigDecimal("100"))>0||value.scale()>4)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Shocks must be -100..100 percent, at most four decimals");}
 public static BigDecimal project(BigDecimal value,BigDecimal shock){shock(shock);return money(value.multiply(BigDecimal.ONE.add(shock.movePointLeft(2))));}
 @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
 public Result evaluate(long portfolioId,Scenario requested){
  // New private analytics follow the existing fixed local-demo SSE/Next boundary.
  if(portfolioId!=1)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Risk Lab is scoped to local demo portfolio 1");
  Portfolio portfolio=portfolios.findById(portfolioId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Portfolio not found"));
  BigDecimal broad=requested==null||requested.broadShockPct()==null?BigDecimal.ZERO:requested.broadShockPct();shock(broad);
  Map<Long,BigDecimal> overrides=requested==null||requested.assetShocks()==null?Map.of():requested.assetShocks();if(overrides.size()>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Too many shocks");overrides.values().forEach(RiskLabService::shock);
  List<HoldingResponse> owned=holdings.getHoldings(portfolioId);if(owned.size()>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Risk Lab supports at most 100 positions");
  if(overrides.keySet().stream().anyMatch(id->owned.stream().noneMatch(h->Objects.equals(h.assetId(),id))))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Asset shock must reference a held asset");
  List<String>warnings=new ArrayList<>();Map<String,MarketPrice> quotes=new HashMap<>();
  try{for(var quote:market.getCurrentPrices())quotes.put(quote.symbol(),quote);}catch(Exception ex){warnings.add("Live fictional quotes unavailable; no catalog prices substituted");}
  List<Position> positions=new ArrayList<>();BigDecimal invested=BigDecimal.ZERO,projected=portfolio.getCashBalance(),cost=BigDecimal.ZERO;boolean complete=true;
  for(var h:owned){var q=quotes.get(h.symbol());BigDecimal s=overrides.getOrDefault(h.assetId(),broad);
   boolean valid=q!=null&&q.price()!=null&&q.price().signum()>0&&h.currency().equals(q.currency())&&q.updatedAt()!=null&&!q.updatedAt().isBefore(Instant.now().minusSeconds(60))&&!q.updatedAt().isAfter(Instant.now().plusSeconds(10));
   BigDecimal value=valid?money(h.quantity().multiply(q.price()).multiply(h.currentFxRate())):null;
   if(value==null){complete=false;warnings.add("Missing recent quote: "+h.symbol());}else{invested=invested.add(value);projected=projected.add(project(value,s));}
   BigDecimal basis=h.historicalCostInPortfolioCurrency();if(basis!=null)cost=cost.add(basis);
   positions.add(new Position(h.assetId(),h.symbol(),h.quantity(),valid?q.price():null,h.currentFxRate(),value,basis,value==null||basis==null?null:value.subtract(basis),null,s,value==null?null:project(value,s),value==null?null:project(value,s).subtract(value)));
  }
  BigDecimal total=complete?invested.add(portfolio.getCashBalance()):null;BigDecimal largest=BigDecimal.ZERO;double hhi=0;
  List<Position> allocated=new ArrayList<>();for(var p:positions){BigDecimal allocation=total==null||p.marketValue()==null?null:pct(p.marketValue(),total);if(allocation!=null)largest=largest.max(allocation);if(complete&&invested.signum()>0){double w=p.marketValue().divide(invested,12,RoundingMode.HALF_UP).doubleValue();hhi+=w*w;}allocated.add(new Position(p.assetId(),p.symbol(),p.quantity(),p.price(),p.fxRate(),p.marketValue(),p.costBasis(),p.unrealizedGainLoss(),allocation,p.shockPct(),p.projectedValue(),p.impact()));}
  if(!complete)warnings.add("Totals, allocations and scenario aggregate are unavailable until every position has a recent quote");
  Metrics metrics=metrics(portfolio,owned);if(metrics.reason()!=null)warnings.add(metrics.reason());
  boolean allCosts=owned.stream().allMatch(h->h.historicalCostInPortfolioCurrency()!=null);
  return new Result(portfolioId,portfolio.getCurrency(),portfolio.getCashBalance(),total,complete?money(projected):null,complete?money(projected.subtract(total)):null,complete?pct(projected.subtract(total),total):null,total==null?null:pct(portfolio.getCashBalance(),total),complete?largest:null,complete&&invested.signum()>0?hhi:null,complete&&hhi>0?1/hhi:null,complete&&allCosts?money(invested.subtract(cost)):null,allocated,metrics,warnings,new Scenario(broad,Map.copyOf(overrides)),true,false,
   "Hypothetical read-only repricing: cash fixed; each asset shock overrides the broad shock. Position value = quantity x recent simulated quote x existing reference FX. Historical portfolio-currency cost defines unrealized gain/loss. Asset-only HHI=sum of squared invested weights; effective positions=1/HHI. Sector classifications are unavailable. History metrics: static current holdings plus cash, no rebalancing/dividends/fees, completed UTC daily fixtures, sample log-return volatility x sqrt(365), peak-to-trough drawdown. Current reference FX held constant; historical multi-currency metrics withheld.");
 }
 private Metrics metrics(Portfolio portfolio,List<HoldingResponse> owned){
  if(owned.isEmpty())return new Metrics(0d,0d,0,List.of(),"Cash-only portfolio: no asset return history or correlations");
  if(owned.size()>25)return new Metrics(null,null,0,List.of(),"Historical pairwise metrics bounded to 25 positions");
  if(owned.stream().anyMatch(h->!h.currency().equals(portfolio.getCurrency())))return new Metrics(null,null,0,List.of(),"Historical FX series unavailable; multi-currency historical metrics withheld");
  LocalDate to=LocalDate.now(ZoneOffset.UTC),from=to.minusDays(90);List<List<ResearchHistoryStore.Candle>> series=new ArrayList<>();
  for(var h:owned){var candles=history.read(h.assetId(),from,to);if(candles.size()!=90)return new Metrics(null,null,0,List.of(),"Insufficient stored history: open each held asset in Research for the last 90 completed days");for(int i=0;i<90;i++)if(!candles.get(i).time().equals(from.plusDays(i).atStartOfDay(ZoneOffset.UTC).toInstant()))return new Metrics(null,null,0,List.of(),"Historical candle gaps; metrics unavailable");series.add(candles);}
  List<Double> nav=new ArrayList<>();List<List<Double>> returns=new ArrayList<>();for(var s:series){List<Double>x=new ArrayList<>();for(int i=1;i<s.size();i++)x.add(Math.log(s.get(i).close().doubleValue()/s.get(i-1).close().doubleValue()));returns.add(x);}
  for(int i=0;i<90;i++){double v=portfolio.getCashBalance().doubleValue();for(int j=0;j<owned.size();j++)v+=owned.get(j).quantity().doubleValue()*series.get(j).get(i).close().doubleValue();nav.add(v);}
  if(nav.stream().anyMatch(v->v<=0||!Double.isFinite(v)))return new Metrics(null,null,0,List.of(),"Nonpositive historical portfolio value; returns unavailable");
  List<Double> portfolioReturns=new ArrayList<>();for(int i=1;i<nav.size();i++)portfolioReturns.add(Math.log(nav.get(i)/nav.get(i-1)));
  List<Correlation> correlations=new ArrayList<>();for(int a=0;a<owned.size();a++)for(int b=a+1;b<owned.size();b++)correlations.add(new Correlation(owned.get(a).assetId(),owned.get(b).assetId(),ResearchMath.correlation(returns.get(a),returns.get(b)),89));
  return new Metrics(ResearchMath.standardDeviation(portfolioReturns)*Math.sqrt(365)*100,ResearchMath.maxDrawdown(nav),90,correlations,null);
 }
}
