package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.Asset;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.portfoliolab.backend.portfolio.PerformanceAccountingTests.*;

/** Isolated test portfolios; all financial fixtures roll back. Never rewrites user history. */
@SpringBootTest(properties={"oms.worker.initial-delay=3600000"})
@Transactional
class PortfolioIntelligenceIntegrationTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired PortfolioIntelligenceService service;
    @Autowired com.portfoliolab.backend.history.PortfolioHistoryRecorder recorder;
    @Autowired PortfolioRepository portfolios;
    @MockitoBean OrderPricingService pricing;
    long asset,p;Instant base;
    @BeforeEach void setup(){
        base=Instant.now().minusSeconds(14400);
        asset=jdbc.queryForObject("SELECT MIN(id) FROM assets WHERE currency='INR'",Long.class);
        p=jdbc.queryForObject("INSERT INTO portfolios(name,cash_balance,currency) VALUES('M44 isolated test',440,'INR') RETURNING id",Long.class);
        when(pricing.calculate(any(Asset.class),any(Portfolio.class),any(BigDecimal.class))).thenAnswer(call->{BigDecimal q=call.getArgument(2);return new OrderPricingService.Pricing(n("120"),q.multiply(n("120")),BigDecimal.ONE,q.multiply(n("120")));});
    }
    void fill(String side,String quantity,String amount,Instant time){jdbc.update("""
        INSERT INTO transactions(portfolio_id,asset_id,transaction_type,quantity,price_per_unit,total_amount,currency,execution_fx_rate,portfolio_amount,created_at)
        VALUES(?,?,?,?,?,?,'INR',1,?,?)
        """,p,asset,side,n(quantity),n(amount).divide(n(quantity),4,RoundingMode.HALF_UP),n(amount),n(amount),Timestamp.from(time));}
    long snapshot(Instant time,String quantity,String value,String cash,boolean verified){
        long s=jdbc.queryForObject("""
            INSERT INTO portfolio_snapshots(portfolio_id,captured_at,cash_balance,holdings_value,total_value,currency,valuation_source,positions_verified)
            VALUES(?,?,?,?,?,'INR','GO_SIMULATOR',?) RETURNING id
            """,Long.class,p,Timestamp.from(time),n(cash),n(value),n(value).add(n(cash)),verified);
        if(verified&&n(quantity).signum()>0)jdbc.update("INSERT INTO portfolio_snapshot_positions(snapshot_id,asset_id,quantity,price,quote_time,market_value) VALUES(?,?,?,?,?,?)",s,asset,n(quantity),n(value).divide(n(quantity),4,RoundingMode.HALF_UP),Timestamp.from(time),n(value));
        return s;
    }
    void tradedPortfolio(){
        fill("BUY","6","480",base);fill("BUY","4","320",base.plusSeconds(1));
        snapshot(base.plusSeconds(3600),"10","1000","0",true);
        fill("SELL","2","220",base.plusSeconds(5400));fill("SELL","2","220",base.plusSeconds(5400));
        snapshot(base.plusSeconds(7200),"6","720","440",true);
        jdbc.update("INSERT INTO holdings(portfolio_id,asset_id,quantity,average_buy_price,historical_cost_portfolio) VALUES(?,?,6,80,480)",p,asset);
    }
    @Test void actualSqlReconstructsPartialFillsAndReconcilesPeriodContribution(){
        tradedPortfolio();var result=service.performance(p,"7D");
        assertEquals(2,result.series().size());equal("1160",result.endingValue());equal("160",result.absoluteChange());equal("16",result.returnPct());
        var row=result.attribution().getFirst();equal("120",row.lifetimeRealized());equal("240",row.lifetimeUnrealized());equal("360",row.lifetimeTotal());equal("160",row.periodContribution());equal("120",row.periodRealized());equal("480",row.costBasis());
        equal("160",result.attribution().stream().map(PortfolioIntelligenceService.Attribution::periodContribution).reduce(BigDecimal.ZERO,BigDecimal::add));
    }
    @Test void cashOnlyObservationsAreNotTodaysCashAppliedToHistory(){snapshot(base,"0","0","100",true);snapshot(base.plusSeconds(3600),"0","0","150",true);var r=service.performance(p,"1M");equal("100",r.startingValue());equal("150",r.endingValue());equal("50",r.absoluteChange());assertNull(r.returnPct(),"Unexplained cash movement must not be investment gain");}
    @Test void absentHistoryIsExplicitAndPortfolioScoped(){var r=service.performance(p,"7D");assertEquals("EMPTY",r.status());assertTrue(r.series().isEmpty());assertNull(r.returnPct());assertNull(r.startingValue());assertTrue(r.attribution().isEmpty());}
    @Test void legacySnapshotsDoNotInventPositionPrices(){snapshot(base,"0","100","100",false);snapshot(base.plusSeconds(3600),"0","200","100",false);var r=service.performance(p,"ALL");assertEquals("PARTIAL",r.status());assertNull(r.returnPct());equal("100",r.absoluteChange());}
    @Test void missingCurrentQuoteDoesNotInvalidateValidHistoricalAttribution(){tradedPortfolio();when(pricing.calculate(any(),any(),any())).thenThrow(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Missing quote"));var r=service.performance(p,"7D");assertNull(r.attribution().getFirst().lifetimeUnrealized());assertNull(r.attribution().getFirst().lifetimeTotal());equal("160",r.attribution().getFirst().periodContribution());}
    @Test void manualDividendsAreIncomeRatherThanExternalDeposits(){tradedPortfolio();jdbc.update("INSERT INTO simulated_dividend_payments(portfolio_id,asset_id,reference_key,eligible_shares,dividend_per_share,amount,currency,created_at) VALUES(?,?,'M44-test',10,4,40,'INR',?)",p,asset,Timestamp.from(base.plusSeconds(5500)));jdbc.update("UPDATE portfolio_snapshots SET cash_balance=480,total_value=1200 WHERE portfolio_id=? AND captured_at=?",p,Timestamp.from(base.plusSeconds(7200)));var r=service.performance(p,"7D");equal("20",r.returnPct());equal("200",r.attribution().getFirst().periodContribution());equal("40",r.attribution().getFirst().dividends());}
    @Test void periodBoundaryExcludesOlderObservations(){snapshot(Instant.now().minus(Duration.ofDays(8)),"0","0","100",true);snapshot(base,"0","0","100",true);var r=service.performance(p,"7D");assertEquals(1,r.series().size());assertNull(r.returnPct());}
    @Test void fullyClosedPositionsRemainInAttribution(){fill("BUY","2","160",base);snapshot(base.plusSeconds(3600),"2","200","0",true);fill("SELL","2","240",base.plusSeconds(5400));snapshot(base.plusSeconds(7200),"0","0","240",true);var r=service.performance(p,"7D");equal("80",r.attribution().getFirst().lifetimeRealized());equal("0",r.attribution().getFirst().lifetimeUnrealized());equal("40",r.attribution().getFirst().periodContribution());}
    @Test void holdingHistoryMismatchWithholdsLifetimeGains(){fill("BUY","2","160",base);jdbc.update("INSERT INTO holdings(portfolio_id,asset_id,quantity,average_buy_price,historical_cost_portfolio) VALUES(?,?,3,80,240)",p,asset);var r=service.performance(p,"7D");assertNull(r.attribution().getFirst().lifetimeRealized());assertNull(r.attribution().getFirst().lifetimeUnrealized());}
    @Test void recorderStoresActualPositionPricesAndFreshLockedCash(){
        tradedPortfolio();String symbol=jdbc.queryForObject("SELECT symbol FROM assets WHERE id=?",String.class,asset);
        Portfolio stale=portfolios.findById(p).orElseThrow();
        jdbc.update("UPDATE portfolios SET cash_balance=500 WHERE id=?",p);
        var quote=new com.portfoliolab.backend.market.MarketPrice(symbol,n("120"),"INR",Instant.now());
        org.springframework.test.util.ReflectionTestUtils.invokeMethod(recorder,"recordPortfolio",stale,Map.of(symbol,quote));
        var r=service.performance(p,"7D");var last=r.series().getLast();assertTrue(last.verified());equal("500",last.cash());equal("720",last.marketValue());
        equal("6",jdbc.queryForObject("SELECT quantity FROM portfolio_snapshot_positions WHERE snapshot_id=? AND asset_id=?",BigDecimal.class,last.id(),asset));
    }
    @Test void scheduledDividendsUseCreditedTimeAndDoNotDoubleCountManualIncome(){
        tradedPortfolio();long schedule=jdbc.queryForObject("INSERT INTO simulated_dividend_schedules(asset_id,reference_key,dividend_per_share,currency,record_cutoff,payment_at) VALUES(?,'M44-scheduled-test',4,'INR',?,?) RETURNING id",Long.class,asset,Timestamp.from(base),Timestamp.from(base.plusSeconds(4000)));
        jdbc.update("INSERT INTO simulated_scheduled_dividend_payments(schedule_id,portfolio_id,eligible_shares,amount,credited_at) VALUES(?,?,10,40,?)",schedule,p,Timestamp.from(base.plusSeconds(5500)));
        jdbc.update("UPDATE portfolio_snapshots SET cash_balance=480,total_value=1200 WHERE portfolio_id=? AND captured_at=?",p,Timestamp.from(base.plusSeconds(7200)));
        var r=service.performance(p,"7D");equal("200",r.attribution().getFirst().periodContribution());equal("40",r.attribution().getFirst().dividends());equal("20",r.returnPct());
    }
}
