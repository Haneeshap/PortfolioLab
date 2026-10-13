package com.portfoliolab.backend.businessrules;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MarketRulesServiceTest {

    private final MarketRulesService service =
            new MarketRulesService();

    private BigDecimal amount(String value) {
        return new BigDecimal(value);
    }

    @Test
    void indianBuyPassesWithSuppliedLimits() {
        var result = service.evaluate(
                "NSE", "BUY", 10, amount("250"),
                amount("3000"), null, amount("20"),
                amount("240"), amount("260"), 1L);

        assertEquals("INR", result.currency());
        assertEquals("PASS", result.overallStatus());
    }

    @Test
    void usBuyFailsWhenCashIsInsufficient() {
        var result = service.evaluate(
                "NASDAQ", "BUY", 10, amount("100"),
                amount("500"), null, amount("5"),
                amount("90"), amount("110"), 1L);

        assertEquals("USD", result.currency());
        assertEquals("FAIL", result.overallStatus());
    }

    @Test
    void indianSellRejectsInsufficientShares() {
        var result = service.evaluate(
                "BSE", "SELL", 20, amount("150"),
                null, 5L, null,
                amount("140"), amount("160"), 1L);

        assertEquals("FAIL", result.overallStatus());
    }

    @Test
    void missingPriceLimitsAreNotAssumedValid() {
        var result = service.evaluate(
                "NYSE", "BUY", 2, amount("100"),
                amount("500"), null, amount("0"),
                null, null, 1L);

        assertEquals("NEEDS_DATA", result.overallStatus());
    }

    @Test
    void rejectsInvalidQuantityIncrement() {
        var result = service.evaluate(
                "NSE", "BUY", 7, amount("100"),
                amount("1000"), null, amount("0"),
                amount("90"), amount("110"), 5L);

        assertEquals("FAIL", result.overallStatus());
    }

    @Test
    void rejectsUnsupportedMarket() {
        assertThrows(IllegalArgumentException.class, () ->
                service.evaluate(
                        "UNKNOWN", "BUY", 1, amount("100"),
                        amount("500"), null, amount("0"),
                        null, null, 1L));
    }
}