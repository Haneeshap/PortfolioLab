package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.Asset;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class HoldingHistoricalCostTest {

    private Holding holding() {
        return new Holding(
                mock(Portfolio.class),
                new Asset(
                        "USDTEST",
                        "USD Test",
                        new BigDecimal("100"),
                        "USD"
                ),
                new BigDecimal("10"),
                new BigDecimal("100")
        );
    }

    @Test
    void additionalBuyAddsConvertedPurchaseCost() {
        Holding holding = holding();
        holding.setHistoricalCostPortfolio(
                new BigDecimal("85000")
        );

        BigDecimal additionalCost = new BigDecimal("17200");

        holding.updatePosition(
                new BigDecimal("12"),
                new BigDecimal("100")
        );

        holding.setHistoricalCostPortfolio(
                holding.getHistoricalCostPortfolio()
                        .add(additionalCost)
        );

        assertEquals(
                0,
                new BigDecimal("102200").compareTo(
                        holding.getHistoricalCostPortfolio()
                )
        );
    }

    @Test
    void partialSellReducesRemainingHistoricalCost() {
        Holding holding = holding();
        holding.setHistoricalCostPortfolio(
                new BigDecimal("85000")
        );

        BigDecimal remaining = new BigDecimal("6");

        BigDecimal remainingCost = holding
                .getHistoricalCostPortfolio()
                .multiply(remaining)
                .divide(
                        holding.getQuantity(),
                        4,
                        RoundingMode.HALF_UP
                );

        holding.updatePosition(
                remaining,
                holding.getAverageBuyPrice()
        );

        holding.setHistoricalCostPortfolio(remainingCost);

        assertEquals(
                0,
                new BigDecimal("51000").compareTo(
                        holding.getHistoricalCostPortfolio()
                )
        );
    }
}