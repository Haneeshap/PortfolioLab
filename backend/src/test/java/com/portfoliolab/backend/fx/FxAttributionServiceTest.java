package com.portfoliolab.backend.fx;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class FxAttributionServiceTest {

    private final FxAttributionService service =
        new FxAttributionService();

    @Test
    void separatesAssetAndCurrencyImpact() {
        var result = service.calculate(
            new BigDecimal("1"),
            new BigDecimal("100"),
            new BigDecimal("110"),
            new BigDecimal("85"),
            new BigDecimal("83")
        );

        assertEquals(
            0,
            result.originalValue().compareTo(new BigDecimal("8500"))
        );

        assertEquals(
            0,
            result.currentValue().compareTo(new BigDecimal("9130"))
        );

        assertEquals(
            0,
            result.assetImpact().compareTo(new BigDecimal("850"))
        );

        assertEquals(
            0,
            result.fxImpact().compareTo(new BigDecimal("-220"))
        );

        assertEquals(
            0,
            result.netChange().compareTo(new BigDecimal("630"))
        );

        assertEquals(
            0,
            result.assetImpact()
                .add(result.fxImpact())
                .compareTo(result.netChange())
        );
    }

    @Test
    void unchangedPricesProduceZeroReturn() {
        var result = service.calculate(
            BigDecimal.ONE,
            new BigDecimal("100"),
            new BigDecimal("100"),
            new BigDecimal("85"),
            new BigDecimal("85")
        );

        assertEquals(0, result.netChange().signum());
        assertEquals(0, result.returnPercent().signum());
    }

    @Test
    void rejectsInvalidQuantity() {
        assertThrows(
            ResponseStatusException.class,
            () -> service.calculate(
                BigDecimal.ZERO,
                new BigDecimal("100"),
                new BigDecimal("110"),
                new BigDecimal("85"),
                new BigDecimal("83")
            )
        );
    }
}