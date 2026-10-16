package com.portfoliolab.backend.portfolio;

import org.junit.jupiter.api.Test;
import java.math.*;
import java.time.Instant;
import java.util.*;
import static com.portfoliolab.backend.portfolio.PerformanceAccounting.*;
import static org.junit.jupiter.api.Assertions.*;

class PerformanceAccountingTests {
    static BigDecimal n(String value){return new BigDecimal(value);}
    static Fill fill(long asset,String side,String quantity,String amount){return new Fill(asset,"FICTION",side,n(quantity),n(amount),Instant.parse("2026-10-16T10:00:00Z"));}
    static void equal(String expected,BigDecimal value){assertEquals(0,n(expected).compareTo(value),()->"Expected "+expected+", got "+value);}
    @Test void emptyHasNoInventedPositions(){assertTrue(replay(List.of()).isEmpty());assertNull(pct(BigDecimal.ZERO,BigDecimal.ZERO));}
    @Test void purchasesUsePortfolioCurrencyAmounts(){var p=replay(List.of(fill(1,"BUY","2","100"),fill(1,"BUY","3","300"))).get(1L);equal("5",p.quantity());equal("400",p.cost());equal("0",p.realized());}
    @Test void partialSalesUseWeightedAverageRemainingBasis(){var p=replay(List.of(fill(1,"BUY","2","100"),fill(1,"BUY","3","300"),fill(1,"SELL","2","200"))).get(1L);equal("3",p.quantity());equal("240",p.cost());equal("40",p.realized());}
    @Test void closedPositionsRetainRealizedGain(){var p=replay(List.of(fill(1,"BUY","3","100"),fill(1,"SELL","1","40"),fill(1,"SELL","2","90"))).get(1L);equal("0",p.quantity());equal("0",p.cost());equal("30",p.realized());}
    @Test void repeatedPartialFillsDoNotDoubleCountReceipts(){var p=replay(List.of(fill(1,"BUY","2","20"),fill(1,"BUY","3","30"),fill(1,"SELL","1","15"))).get(1L);equal("4",p.quantity());equal("40",p.cost());equal("5",p.realized());}
    @Test void sameTimestampPreservesInputTransactionIdOrder(){var p=replay(List.of(fill(1,"BUY","1","10"),fill(1,"SELL","1","12"),fill(1,"BUY","1","20"))).get(1L);equal("20",p.cost());equal("2",p.realized());}
    @Test void roundingMatchesPersistedPartialSaleConvention(){var p=replay(List.of(fill(1,"BUY","3","100"),fill(1,"SELL","1","40"))).get(1L);equal("66.6667",p.cost());equal("6.6667",p.realized());}
    @Test void impossibleHistoryFailsInsteadOfInventingBasis(){assertThrows(IllegalArgumentException.class,()->replay(List.of(fill(1,"SELL","1","10"))));}
    @Test void assetsStayIsolated(){var p=replay(List.of(fill(1,"BUY","1","10"),fill(2,"BUY","2","50"),fill(2,"SELL","1","30")));equal("10",p.get(1L).cost());equal("25",p.get(2L).cost());equal("5",p.get(2L).realized());}
    @Test void contributionsExcludeTradingCashAndIncludeIncome(){equal("35",contribution(n("100"),n("180"),n("100"),n("50"),n("5")));equal("0",contribution(n("0"),n("100"),n("100"),n("0"),n("0")));}
    @Test void positiveAndNegativeReturn(){equal("10",pct(n("10"),n("100")));equal("-10",pct(n("-10"),n("100")));}
}
