
package com.portfoliolab.backend.dividend;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

class DividendSimulationServiceTest {

    private final DividendSimulationService service =
            new DividendSimulationService();

    @Test
    void calculatesGrossDividend() {
        BigDecimal result = service.calculateGrossDividend(
                new BigDecimal("50"),
                new BigDecimal("5")
        );

        assertEquals(new BigDecimal("250.00"), result);
    }

    @Test
    void zeroSharesProducesZeroPayout() {
        BigDecimal result = service.calculateGrossDividend(
                BigDecimal.ZERO,
                new BigDecimal("5")
        );

        assertEquals(new BigDecimal("0.00"), result);
    }

    @Test
    void supportsFractionalDividendRates() {
        BigDecimal result = service.calculateGrossDividend(
                new BigDecimal("12"),
                new BigDecimal("2.75")
        );

        assertEquals(new BigDecimal("33.00"), result);
    }

    @Test
    void rejectsNegativeShares() {
        assertThrows(
                IllegalArgumentException.class,
                () -> service.calculateGrossDividend(
                        new BigDecimal("-1"),
                        new BigDecimal("5")
                )
        );
    }

    @Test
    void rejectsNegativeDividendRates() {
        assertThrows(
                IllegalArgumentException.class,
                () -> service.calculateGrossDividend(
                        new BigDecimal("10"),
                        new BigDecimal("-2")
                )
        );
    }

    @Test
    void rejectsFractionalShareQuantities() {
        assertThrows(
                IllegalArgumentException.class,
                () -> service.calculateGrossDividend(
                        new BigDecimal("10.5"),
                        new BigDecimal("5")
                )
        );
    }

    @Test
    void rejectsMissingInputs() {
        assertThrows(
                IllegalArgumentException.class,
                () -> service.calculateGrossDividend(
                        null,
                        new BigDecimal("5")
                )
        );
    }
}
