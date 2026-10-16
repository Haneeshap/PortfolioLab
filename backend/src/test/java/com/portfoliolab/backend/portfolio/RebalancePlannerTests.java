package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.*;
import com.portfoliolab.backend.oms.OrderReservations;
import com.portfoliolab.backend.risk.PreTradeRiskService;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.*;
import java.math.*;
import java.sql.ResultSet;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.portfoliolab.backend.portfolio.PerformanceAccountingTests.*;
import static com.portfoliolab.backend.portfolio.PortfolioIntelligenceService.*;

class RebalancePlannerTests {
    JdbcTemplate jdbc=mock(JdbcTemplate.class); PortfolioRepository portfolios=mock(PortfolioRepository.class);
    AssetRepository assets=mock(AssetRepository.class); OrderPricingService pricing=mock(OrderPricingService.class);
    OrderReservations reservations=mock(OrderReservations.class);PreTradeRiskService risk=mock(PreTradeRiskService.class);
    Portfolio portfolio=mock(Portfolio.class);Asset asset=mock(Asset.class);
    PortfolioIntelligenceService service=new PortfolioIntelligenceService(jdbc,portfolios,assets,pricing,reservations,risk);
    @BeforeEach void setup(){when(portfolios.findById(1L)).thenReturn(Optional.of(portfolio));when(portfolio.getId()).thenReturn(1L);when(portfolio.getCashBalance()).thenReturn(n("1000"));when(portfolio.getCurrency()).thenReturn("INR");when(assets.findById(1L)).thenReturn(Optional.of(asset));when(asset.getId()).thenReturn(1L);when(asset.getSymbol()).thenReturn("FICTION");when(pricing.calculate(eq(asset),eq(portfolio),any())).thenReturn(new OrderPricingService.Pricing(n("100"),n("100"),BigDecimal.ONE,n("100")));when(reservations.cash(1,-1)).thenReturn(BigDecimal.ZERO);when(reservations.shares(1,1,-1)).thenReturn(BigDecimal.ZERO);when(risk.evaluate(any(),any(),anyString(),any(),any())).thenReturn(new PreTradeRiskService.Decision("ALLOW",List.of(),"simulation"));}
    void position(String qty,String cost) throws Exception{
        doAnswer(call->{ResultSet rs=mock(ResultSet.class);when(rs.getLong(1)).thenReturn(1L);when(rs.getBigDecimal(2)).thenReturn(n(qty));when(rs.getBigDecimal(3)).thenReturn(n(cost));call.<RowCallbackHandler>getArgument(1).processRow(rs);return null;}).when(jdbc).query(startsWith("SELECT asset_id,quantity,historical_cost_portfolio"),any(RowCallbackHandler.class),eq(1L));
    }
    Targets target(String allocation,String cash){return new Targets(Map.of(1L,n(allocation)),n(cash));}
    @BeforeEach void projectedRisk(){when(risk.evaluateAgainstCosts(any(),any(),anyString(),any(),any(),any(),any())).thenReturn(new PreTradeRiskService.Decision("ALLOW",List.of(),"simulation"));}
    @Test void invalidTotalsAndPrecision(){for(Targets t:List.of(target("20","70"),target("90","20"),target("-1","101"),target("100.00001","0")))assertThrows(RuntimeException.class,()->validate(t));validate(target("99.9999","0"));}
    @Test void emptyZeroEquityHasNoInventedAllocation(){when(portfolio.getCashBalance()).thenReturn(BigDecimal.ZERO);var p=service.plan(1,target("100","0"));assertNull(p.projectedCashPct());equal("0",p.projectedCash());equal("0",p.adjustments().getFirst().quantity());}
    @Test void bufferConstrainsPurchaseAndCashIsConserved(){var p=service.plan(1,target("100","0"));equal("9",p.adjustments().getFirst().quantity());equal("100",p.projectedCash());assertFalse(p.feasible());equal("1000",p.projectedCash().add(p.adjustments().getFirst().notional()));}
    @Test void cashReservationsReduceBuyingPower(){when(reservations.cash(1,-1)).thenReturn(n("600"));var p=service.plan(1,target("100","0"));equal("400",p.buyingPower());equal("3",p.adjustments().getFirst().quantity());equal("700",p.projectedCash());}
    @Test void pendingPartialOrderReservesRemainingShares() throws Exception{position("10","800");when(reservations.shares(1,1,-1)).thenReturn(n("7"));var p=service.plan(1,target("0","100"));equal("3",p.adjustments().getFirst().quantity());equal("7",p.adjustments().getFirst().projectedQuantity());equal("1300",p.projectedCash());assertFalse(p.feasible());}
    @Test void fullyInvestedSalesLeaveNonnegativeCash() throws Exception{position("10","800");when(portfolio.getCashBalance()).thenReturn(BigDecimal.ZERO);var p=service.plan(1,target("0","100"));equal("1000",p.projectedCash());assertTrue(p.feasible());}
    @Test void wholeShareRoundingLeavesResidualCash(){var p=service.plan(1,target("55","45"));equal("5",p.adjustments().getFirst().quantity());equal("500",p.projectedCash());assertFalse(p.feasible());}
    @Test void changedQuoteRecalculatesQuantities(){var a=service.plan(1,target("50","50"));when(pricing.calculate(eq(asset),eq(portfolio),any())).thenReturn(new OrderPricingService.Pricing(n("200"),n("200"),BigDecimal.ONE,n("200")));var b=service.plan(1,target("50","50"));equal("5",a.adjustments().getFirst().quantity());equal("2",b.adjustments().getFirst().quantity());}
    @Test void riskBlockProducesNoAdjustment(){when(risk.evaluate(any(),any(),anyString(),any(),any())).thenReturn(new PreTradeRiskService.Decision("BLOCK",List.of(new PreTradeRiskService.Check("MAX_ORDER_VALUE","FAIL","limit")),""));var p=service.plan(1,target("100","0"));equal("0",p.adjustments().getFirst().quantity());equal("1000",p.projectedCash());assertFalse(p.feasible());}
    @Test void sequentialProjectedRiskCanBlockOtherwiseAllowedTicket(){when(risk.evaluateAgainstCosts(any(),any(),anyString(),any(),any(),any(),any())).thenReturn(new PreTradeRiskService.Decision("BLOCK",List.of(new PreTradeRiskService.Check("MAX_POSITION_COST_CONCENTRATION","FAIL","limit")),""));var p=service.plan(1,target("50","50"));equal("0",p.adjustments().getFirst().quantity());equal("1000",p.projectedCash());assertFalse(p.feasible());}
    @Test void hypotheticalSaleProceedsNeverFinanceAnotherAsset() throws Exception{
        position("10","800");when(portfolio.getCashBalance()).thenReturn(BigDecimal.ZERO);
        Asset other=mock(Asset.class);when(other.getId()).thenReturn(2L);when(other.getSymbol()).thenReturn("SECOND");when(assets.findById(2L)).thenReturn(Optional.of(other));when(pricing.calculate(eq(other),eq(portfolio),any())).thenReturn(new OrderPricingService.Pricing(n("100"),n("100"),BigDecimal.ONE,n("100")));
        var p=service.plan(1,new Targets(Map.of(2L,n("100")),BigDecimal.ZERO));
        equal("1000",p.projectedCash());equal("10",p.adjustments().getFirst().quantity());assertEquals("SELL",p.adjustments().getFirst().side());equal("0",p.adjustments().get(1).quantity());assertFalse(p.feasible());
    }
    @Test void unknownAssetAndPortfolioAreRejected(){assertThrows(RuntimeException.class,()->service.plan(2,target("100","0")));assertThrows(RuntimeException.class,()->service.plan(1,new Targets(Map.of(999L,n("100")),BigDecimal.ZERO)));}
    @Test void plannerDoesNotMutateOrReserve() throws Exception{service.plan(1,target("50","50"));verify(portfolio,never()).setCashBalance(any());verify(portfolios,never()).save(any());verify(reservations,never()).reserve(anyLong(),anyLong(),any());verify(jdbc,never()).update(anyString(),any(Object[].class));assertTrue(PortfolioIntelligenceService.class.getMethod("plan",long.class,Targets.class).getAnnotation(org.springframework.transaction.annotation.Transactional.class).readOnly());}
}
