package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.*;
import com.portfoliolab.backend.oms.OrderReservations;
import com.portfoliolab.backend.risk.PreTradeRiskService;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static com.portfoliolab.backend.portfolio.PerformanceAccounting.*;

@Service
public class PortfolioIntelligenceService {
    private final JdbcTemplate jdbc;
    private final PortfolioRepository portfolios;
    private final AssetRepository assets;
    private final OrderPricingService pricing;
    private final OrderReservations reservations;
    private final PreTradeRiskService risk;
    public PortfolioIntelligenceService(JdbcTemplate jdbc, PortfolioRepository portfolios, AssetRepository assets,
            OrderPricingService pricing, OrderReservations reservations, PreTradeRiskService risk) {
        this.jdbc=jdbc; this.portfolios=portfolios; this.assets=assets; this.pricing=pricing;
        this.reservations=reservations; this.risk=risk;
    }
    public record Point(long id, Instant time, BigDecimal cash, BigDecimal marketValue, BigDecimal equity, boolean verified) {}
    public record Attribution(long assetId, String symbol, BigDecimal quantity, BigDecimal costBasis,
            BigDecimal lifetimeRealized, BigDecimal lifetimeUnrealized, BigDecimal lifetimeTotal,
            BigDecimal periodRealized, BigDecimal periodContribution, BigDecimal dividends) {}
    public record AttributionTotals(BigDecimal lifetimeRealized,BigDecimal lifetimeUnrealized,
            BigDecimal lifetimeTotal,BigDecimal periodRealized,BigDecimal periodContribution,BigDecimal periodDividends) {}
    public record Performance(long portfolioId, String currency, String period, Instant requestedFrom, Instant asOf,
            Instant earliestObservation, String status, List<Point> series, BigDecimal startingValue,
            BigDecimal endingValue, BigDecimal absoluteChange, BigDecimal returnPct, String returnMethod,
            List<Attribution> attribution, AttributionTotals totals, List<String> warnings, String accountingMethod) {}
    private static BigDecimal sum(List<Attribution> rows,java.util.function.Function<Attribution,BigDecimal> field){
        BigDecimal total=BigDecimal.ZERO;
        for(Attribution row:rows){BigDecimal value=field.apply(row);if(value==null)return null;total=total.add(value);}
        return money(total);
    }
    private Portfolio portfolio(long id) {
        return portfolios.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Portfolio not found"));
    }
    private record Held(BigDecimal quantity, BigDecimal cost) {}
    private Map<Long,Held> held(long id) {
        Map<Long,Held> result=new TreeMap<>();
        jdbc.query("SELECT asset_id,quantity,historical_cost_portfolio FROM holdings WHERE portfolio_id=? ORDER BY asset_id LIMIT 101",
                rs -> {result.put(rs.getLong(1),new Held(rs.getBigDecimal(2),rs.getBigDecimal(3)));},id);
        if(result.size()>100) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"At most 100 positions supported");
        return result;
    }
    private List<Fill> fills(long id, Instant end) {
        var result=jdbc.query("""
            SELECT t.asset_id,a.symbol,t.transaction_type,t.quantity,t.portfolio_amount,t.created_at
            FROM transactions t JOIN assets a ON a.id=t.asset_id
            WHERE t.portfolio_id=? AND t.created_at<=? ORDER BY t.created_at,t.id LIMIT 50001
            """,(rs,n)->new Fill(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getBigDecimal(4),rs.getBigDecimal(5),rs.getTimestamp(6).toInstant()),id,Timestamp.from(end));
        if(result.size()>50000)throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"History exceeds 50000 settled transactions; analytics unavailable");
        return result;
    }
    private Map<Long,BigDecimal> dividends(long id,Instant from,Instant to) {
        Map<Long,BigDecimal> result=new TreeMap<>();
        jdbc.query("""
            SELECT asset_id,SUM(amount) FROM (
              SELECT asset_id,amount,created_at FROM simulated_dividend_payments WHERE portfolio_id=?
              UNION ALL
              SELECT s.asset_id,p.amount,p.credited_at AS created_at FROM simulated_scheduled_dividend_payments p
              JOIN simulated_dividend_schedules s ON s.id=p.schedule_id WHERE p.portfolio_id=?
            ) d WHERE created_at>? AND created_at<=? GROUP BY asset_id
            """,rs->{result.put(rs.getLong(1),rs.getBigDecimal(2));},id,id,Timestamp.from(from),Timestamp.from(to));
        return result;
    }
    private record Observation(BigDecimal quantity,BigDecimal value) {}
    private Map<Long,Observation> observations(long snapshot) {
        Map<Long,Observation> result=new TreeMap<>();
        jdbc.query("SELECT asset_id,quantity,market_value FROM portfolio_snapshot_positions WHERE snapshot_id=?",rs->{result.put(rs.getLong(1),new Observation(rs.getBigDecimal(2),rs.getBigDecimal(3)));},snapshot);
        return result;
    }
    private static Point point(java.sql.ResultSet rs,int row) throws java.sql.SQLException {
        return new Point(rs.getLong("id"),rs.getTimestamp("captured_at").toInstant(),rs.getBigDecimal("cash_balance"),rs.getBigDecimal("holdings_value"),rs.getBigDecimal("total_value"),rs.getBoolean("positions_verified"));
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Performance performance(long id,String period) {
        Portfolio portfolio=portfolio(id);
        int days=switch(period){case "7D"->7;case "1M"->30;case "3M"->90;case "ALL"->366;default->throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Period must be 7D, 1M, 3M or ALL");};
        // Use the same clock as persisted fill and observation timestamps (including sub-millisecond precision).
        Instant now=Objects.requireNonNull(jdbc.queryForObject("SELECT clock_timestamp()",Timestamp.class)).toInstant(),from=now.minus(Duration.ofDays(days));
        List<String>warnings=new ArrayList<>();
        warnings.add("Observed simulator valuations only. Generated OHLCV fixtures are excluded. UTC dates; no interpolation across missing days.");
        if(period.equals("ALL"))warnings.add("ALL is bounded to the most recent 366 days.");
        var earliest=jdbc.queryForObject("SELECT MIN(captured_at) FROM portfolio_snapshots WHERE portfolio_id=?",Timestamp.class,id);
        List<Point> points=jdbc.query("""
            SELECT * FROM (
              (SELECT DISTINCT ON ((captured_at AT TIME ZONE 'UTC')::date) * FROM portfolio_snapshots
               WHERE portfolio_id=? AND captured_at>=? AND captured_at<=?
               ORDER BY (captured_at AT TIME ZONE 'UTC')::date,captured_at DESC,id DESC)
              UNION
              (SELECT * FROM portfolio_snapshots WHERE portfolio_id=? AND captured_at>=? AND captured_at<=?
               ORDER BY captured_at,id LIMIT 1)
            ) p ORDER BY captured_at,id LIMIT 368
            """,PortfolioIntelligenceService::point,id,Timestamp.from(from),Timestamp.from(now),id,Timestamp.from(from),Timestamp.from(now));
        Point start=points.isEmpty()?null:points.getFirst(),end=points.isEmpty()?null:points.getLast();
        if(start==null)warnings.add("No persisted portfolio observations in this period. Open the simulator and allow the existing recorder to capture data.");
        else if(start.time().isAfter(from.plusSeconds(60)))warnings.add("Requested start is not covered; figures use the actual observed interval shown.");
        if(end!=null&&end.time().isBefore(now.minusSeconds(120)))warnings.add("Latest recorded observation is older than two minutes; historical summary is not a live valuation.");
        var all=fills(id,now);
        Map<Long,Position> lifetime;
        boolean replayValid=true;
        try{lifetime=replay(all);}catch(IllegalArgumentException ex){lifetime=Map.of();replayValid=false;warnings.add(ex.getMessage());}
        Map<Long,Held> current=held(id);
        Set<Long> ids=new TreeSet<>(lifetime.keySet());ids.addAll(current.keySet());
        for(long assetId:ids){var p=lifetime.getOrDefault(assetId,new Position(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO));var h=current.getOrDefault(assetId,new Held(BigDecimal.ZERO,BigDecimal.ZERO));
            if(p.quantity().compareTo(h.quantity())!=0||money(p.cost()).compareTo(money(h.cost()))!=0)replayValid=false;
        }
        if(!replayValid)warnings.add("Settled history does not reconcile with persisted holdings; lifetime P&L withheld.");
        boolean interval=start!=null&&end!=null&&start.id()!=end.id()&&start.verified()&&end.verified();
        Map<Long,Observation> opening=interval?observations(start.id()):Map.of(),closing=interval?observations(end.id()):Map.of();
        Map<Long,BigDecimal> income=interval?dividends(id,start.time(),end.time()):Map.of();
        List<Fill> window=interval?all.stream().filter(f->f.time().isAfter(start.time())&&!f.time().isAfter(end.time())).toList():List.of();
        Map<Long,Position> before=Map.of(),after=Map.of();
        if(interval){
            try{before=replay(all.stream().filter(f->!f.time().isAfter(start.time())).toList());after=replay(all.stream().filter(f->!f.time().isAfter(end.time())).toList());}
            catch(IllegalArgumentException ex){interval=false;}
        }
        ids.addAll(opening.keySet());ids.addAll(closing.keySet());ids.addAll(income.keySet());
        BigDecimal cashDelta=BigDecimal.ZERO;
        for(Fill f:window)cashDelta=cashDelta.add(f.side().equals("BUY")?f.amount().negate():f.amount());
        for(BigDecimal amount:income.values())cashDelta=cashDelta.add(amount);
        if(interval){
            for(long assetId:ids){
                BigDecimal b=before.getOrDefault(assetId,new Position(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO)).quantity();
                BigDecimal a=after.getOrDefault(assetId,new Position(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO)).quantity();
                if(b.compareTo(opening.getOrDefault(assetId,new Observation(BigDecimal.ZERO,BigDecimal.ZERO)).quantity())!=0||a.compareTo(closing.getOrDefault(assetId,new Observation(BigDecimal.ZERO,BigDecimal.ZERO)).quantity())!=0)interval=false;
            }
            if(money(end.cash().subtract(start.cash())).compareTo(money(cashDelta))!=0)interval=false;
            BigDecimal openSum=opening.values().stream().map(Observation::value).reduce(BigDecimal.ZERO,BigDecimal::add);
            BigDecimal closeSum=closing.values().stream().map(Observation::value).reduce(BigDecimal.ZERO,BigDecimal::add);
            if(money(openSum).compareTo(start.marketValue())!=0||money(closeSum).compareTo(end.marketValue())!=0)interval=false;
        }
        if(!interval)warnings.add("Period return and contribution unavailable: need two verified position observations with reconciled settled activity and cash. Legacy snapshots are observational only.");
        warnings.add("No external contribution/withdrawal ledger exists. Returns are supported only for verified intervals whose cash movement is fully explained by persisted trades and dividends; no general cash-flow-adjusted TWR is claimed.");
        List<Attribution> rows=new ArrayList<>();
        for(long assetId:ids){
            Asset asset=assets.findById(assetId).orElseThrow();
            Position p=lifetime.getOrDefault(assetId,new Position(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO));
            Held h=current.getOrDefault(assetId,new Held(BigDecimal.ZERO,BigDecimal.ZERO));
            BigDecimal value=h.quantity().signum()==0?BigDecimal.ZERO:null;
            if(h.quantity().signum()>0){try{value=pricing.calculate(asset,portfolio,h.quantity()).portfolioTotal();}catch(ResponseStatusException ex){warnings.add("Current unrealized P&L unavailable for "+asset.getSymbol()+": "+ex.getReason());}}
            BigDecimal unrealized=value==null||!replayValid?null:money(value.subtract(h.cost()));
            BigDecimal buys=BigDecimal.ZERO,sells=BigDecimal.ZERO;
            for(Fill f:window)if(f.assetId()==assetId){if(f.side().equals("BUY"))buys=buys.add(f.amount());else sells=sells.add(f.amount());}
            BigDecimal periodGain=interval?contribution(opening.getOrDefault(assetId,new Observation(BigDecimal.ZERO,BigDecimal.ZERO)).value(),closing.getOrDefault(assetId,new Observation(BigDecimal.ZERO,BigDecimal.ZERO)).value(),buys,sells,income.getOrDefault(assetId,BigDecimal.ZERO)):null;
            BigDecimal realizedPeriod=interval?after.getOrDefault(assetId,new Position(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO)).realized().subtract(before.getOrDefault(assetId,new Position(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO)).realized()):null;
            rows.add(new Attribution(assetId,asset.getSymbol(),h.quantity(),h.cost(),replayValid?money(p.realized()):null,unrealized,unrealized==null?null:money(p.realized().add(unrealized)),realizedPeriod==null?null:money(realizedPeriod),periodGain,interval?income.getOrDefault(assetId,BigDecimal.ZERO):null));
        }
        BigDecimal change=start==null?null:money(end.equity().subtract(start.equity()));
        AttributionTotals totals=new AttributionTotals(replayValid?sum(rows,Attribution::lifetimeRealized):null,
                replayValid?sum(rows,Attribution::lifetimeUnrealized):null,replayValid?sum(rows,Attribution::lifetimeTotal):null,
                interval?sum(rows,Attribution::periodRealized):null,interval?sum(rows,Attribution::periodContribution):null,
                interval?sum(rows,Attribution::dividends):null);
        boolean fullCoverage=interval&&!start.time().isAfter(from.plusSeconds(60))&&!end.time().isBefore(now.minusSeconds(120));
        return new Performance(id,portfolio.getCurrency(),period,from,now,earliest==null?null:earliest.toInstant(),start==null?"EMPTY":fullCoverage?"AVAILABLE":"PARTIAL",points,start==null?null:start.equity(),end==null?null:end.equity(),change,interval?pct(change,start.equity()):null,"NO_EXTERNAL_FLOW_OBSERVED_INTERVAL",rows,totals,List.copyOf(warnings),"Portfolio-currency weighted-average cost; remaining basis rounded to 4 decimals after each sale. Lifetime P&L excludes dividend income and fees (not modeled). Period contribution includes recorded dividends; observed interval differs from requested interval when coverage is partial.");
    }

    public record Targets(Map<Long,BigDecimal> assets,BigDecimal cashPct) {}
    public record Adjustment(long assetId,String symbol,BigDecimal price,BigDecimal currentQuantity,
            BigDecimal currentPct,BigDecimal targetPct,String side,BigDecimal quantity,BigDecimal notional,
            BigDecimal projectedQuantity,BigDecimal projectedPct,List<String> constraints) {}
    public record Plan(long portfolioId,String currency,Instant asOf,BigDecimal equity,BigDecimal cash,
            BigDecimal reservedCash,BigDecimal buyingPower,BigDecimal projectedCash,BigDecimal projectedCashPct,
            BigDecimal targetCashPct,boolean feasible,List<Adjustment> adjustments,List<String> warnings) {}
    public static void validate(Targets targets) {
        if(targets==null||targets.assets()==null||targets.assets().size()>100||targets.cashPct()==null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Assets and target cash allocation required (maximum 100)");
        BigDecimal sum=targets.cashPct();
        List<BigDecimal> values=new ArrayList<>(targets.assets().values());values.add(targets.cashPct());
        for(BigDecimal value:values)if(value==null||value.signum()<0||value.compareTo(new BigDecimal("100"))>0||value.scale()>4)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Targets must be between 0 and 100 with at most 4 decimal places");
        for(var e:targets.assets().entrySet()){if(e.getKey()==null||e.getKey()<=0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid asset ID");sum=sum.add(e.getValue());}
        if(sum.subtract(new BigDecimal("100")).abs().compareTo(new BigDecimal("0.0001"))>0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Target allocations must total 100% (tolerance 0.0001 percentage points)");
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Plan plan(long id,Targets targets) {
        validate(targets);Portfolio portfolio=portfolio(id);Map<Long,Held> held=held(id);
        TreeSet<Long> ids=new TreeSet<>(held.keySet());ids.addAll(targets.assets().keySet());
        if(ids.size()>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"At most 100 assets supported");
        Map<Long,Asset> catalog=new TreeMap<>();Map<Long,BigDecimal> units=new TreeMap<>();
        BigDecimal equity=portfolio.getCashBalance();
        for(long assetId:ids){Asset asset=assets.findById(assetId).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown fictional asset: "+assetId));catalog.put(assetId,asset);var quote=pricing.calculate(asset,portfolio,BigDecimal.ONE);BigDecimal unit=quote.price().multiply(quote.fxRate());units.put(assetId,unit);equity=equity.add(held.getOrDefault(assetId,new Held(BigDecimal.ZERO,BigDecimal.ZERO)).quantity().multiply(unit));}
        BigDecimal reserved=reservations.cash(id,-1),power=portfolio.getCashBalance().subtract(reserved).max(BigDecimal.ZERO),budget=power;
        BigDecimal cash=portfolio.getCashBalance();List<Adjustment> rows=new ArrayList<>();boolean feasible=true;
        Map<Long,BigDecimal> projectedCosts=new TreeMap<>();held.forEach((assetId,h)->projectedCosts.put(assetId,h.cost()));
        BigDecimal planEquity=equity;
        List<Long> ordered=new ArrayList<>(ids);
        ordered.sort(Comparator.comparingInt((Long assetId)->{
            BigDecimal wanted=planEquity.multiply(targets.assets().getOrDefault(assetId,BigDecimal.ZERO)).divide(new BigDecimal("100"),12,RoundingMode.HALF_UP);
            BigDecimal present=held.getOrDefault(assetId,new Held(BigDecimal.ZERO,BigDecimal.ZERO)).quantity().multiply(units.get(assetId));
            return wanted.compareTo(present)<0?0:1;
        }).thenComparingLong(Long::longValue));
        for(long assetId:ordered){
            Asset asset=catalog.get(assetId);BigDecimal unit=units.get(assetId),quantity=held.getOrDefault(assetId,new Held(BigDecimal.ZERO,BigDecimal.ZERO)).quantity();
            BigDecimal target=targets.assets().getOrDefault(assetId,BigDecimal.ZERO),value=quantity.multiply(unit);
            BigDecimal desired=equity.multiply(target).divide(new BigDecimal("100"),12,RoundingMode.HALF_UP);
            BigDecimal delta=desired.subtract(value);String side=delta.signum()<0?"SELL":"BUY";
            BigDecimal proposed=delta.abs().divide(unit,0,RoundingMode.DOWN).min(new BigDecimal("9999999999999"));
            List<String> constraints=new ArrayList<>();
            if(side.equals("SELL")){
                BigDecimal available=quantity.subtract(reservations.shares(id,assetId,-1)).max(BigDecimal.ZERO).setScale(0,RoundingMode.DOWN);
                if(proposed.compareTo(available)>0){proposed=available;constraints.add("Existing share reservations constrain sales");}
            }else{
                BigDecimal buffer=unit.multiply(new BigDecimal("1.05")).setScale(4,RoundingMode.CEILING);
                BigDecimal affordable=budget.divide(buffer,0,RoundingMode.DOWN);
                if(proposed.compareTo(affordable)>0){proposed=affordable;constraints.add("Current buying power and OMS 5% reservation buffer constrain purchases; planned sale proceeds excluded");}
            }
            BigDecimal notional=money(proposed.multiply(unit));
            if(proposed.signum()>0&&(notional.signum()<=0||notional.precision()>19)){
                constraints.add("Estimated order value is outside OMS monetary precision");proposed=BigDecimal.ZERO;notional=money(BigDecimal.ZERO);
            }
            if(proposed.signum()>0){var decision=risk.evaluate(portfolio,asset,side,proposed,notional);
                if(!decision.decision().equals("BLOCK"))decision=risk.evaluateAgainstCosts(portfolio,asset,side,proposed,notional,projectedCosts.values().stream().reduce(BigDecimal.ZERO,BigDecimal::add),projectedCosts.getOrDefault(assetId,BigDecimal.ZERO));
                if(decision.decision().equals("BLOCK")){constraints.add("Risk policy blocks proposed ticket: "+decision.checks().stream().filter(c->c.status().equals("FAIL")).map(PreTradeRiskService.Check::code).toList());proposed=BigDecimal.ZERO;notional=money(BigDecimal.ZERO);}
            }
            BigDecimal projected=side.equals("BUY")?quantity.add(proposed):quantity.subtract(proposed);
            BigDecimal oldCost=projectedCosts.getOrDefault(assetId,BigDecimal.ZERO);
            projectedCosts.put(assetId,side.equals("BUY")?oldCost.add(notional):quantity.signum()==0?BigDecimal.ZERO:oldCost.multiply(projected).divide(quantity,4,RoundingMode.HALF_UP));
            if(side.equals("BUY")){cash=cash.subtract(notional);budget=budget.subtract(unit.multiply(new BigDecimal("1.05")).setScale(4,RoundingMode.CEILING).multiply(proposed));}else cash=cash.add(notional);
            BigDecimal projectedPct=pct(projected.multiply(unit),equity);
            if(desired.subtract(projected.multiply(unit)).abs().compareTo(new BigDecimal("0.0001"))>0)constraints.add("Whole-share increments or constraints leave target drift");
            if(!constraints.isEmpty())feasible=false;
            rows.add(new Adjustment(assetId,asset.getSymbol(),unit,quantity,pct(value,equity),target,proposed.signum()==0?"HOLD":side,proposed,notional,projected,projectedPct,List.copyOf(constraints)));
        }
        BigDecimal cashPct=pct(cash,equity);
        List<String>warnings=List.of("Read-only hypothetical estimates at current simulated prices; no orders, reservations or events created.","Sales before buys, each in stable asset-ID order. Sale proceeds are excluded from the buy budget. OMS settles immediately on fills.","Shared risk policy checks each ticket against current state and sequential projected cost basis. Pending-order execution and future prices require fresh OMS review; feasibility is not an execution guarantee.","Residual cash includes whole-share rounding and blocked or constrained adjustments; reserved cash remains part of portfolio equity.");
        rows.sort(Comparator.comparingInt((Adjustment a)->a.side().equals("SELL")?0:1).thenComparingLong(Adjustment::assetId));
        if(cashPct==null||cashPct.subtract(targets.cashPct()).abs().compareTo(new BigDecimal("0.0001"))>0)feasible=false;
        return new Plan(id,portfolio.getCurrency(),Instant.now(),money(equity),portfolio.getCashBalance(),reserved,power,money(cash),cashPct,targets.cashPct(),feasible,List.copyOf(rows),warnings);
    }
}
