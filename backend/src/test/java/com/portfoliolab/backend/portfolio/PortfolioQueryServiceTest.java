package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.Asset;
import com.portfoliolab.backend.fx.FrankfurterRateService;
import com.portfoliolab.backend.fx.FrankfurterRateService.ExchangeRate;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class PortfolioQueryServiceTest {

    private PortfolioQueryService createService(
            PortfolioRepository portfolios,
            HoldingRepository holdings,
            FrankfurterRateService fx
    ) {
        return new PortfolioQueryService(
                portfolios,
                holdings,
                mock(TransactionRepository.class),
                fx
        );
    }

    @Test
    void valuesInrHoldingWithoutFxProvider() {
        PortfolioRepository portfolios = mock(PortfolioRepository.class);
        HoldingRepository holdings = mock(HoldingRepository.class);
        FrankfurterRateService fx = mock(FrankfurterRateService.class);

        Portfolio portfolio = mock(Portfolio.class);
        when(portfolio.getCurrency()).thenReturn("INR");
        when(portfolios.findById(1L)).thenReturn(Optional.of(portfolio));

        Asset asset = new Asset(
                "INRDEMO",
                "INR Demo Asset",
                new BigDecimal("125.00"),
                "INR"
        );

        Holding holding = new Holding(
                portfolio,
                asset,
                new BigDecimal("10"),
                new BigDecimal("100.00")
        );

        when(holdings.findByPortfolioId(1L))
                .thenReturn(List.of(holding));

        HoldingResponse result = createService(
                portfolios, holdings, fx
        ).getHoldings(1L).get(0);

        assertEquals(
                0,
                new BigDecimal("1250.00")
                        .compareTo(result.marketValue())
        );

        assertEquals(
                0,
                new BigDecimal("1250.0000")
                        .compareTo(result.marketValueInPortfolioCurrency())
        );

        assertEquals(
                0,
                BigDecimal.ONE.compareTo(result.currentFxRate())
        );

        assertEquals("INR", result.portfolioCurrency());

        verifyNoInteractions(fx);
    }

    @Test
    void convertsUsdHoldingIntoInr() {
        PortfolioRepository portfolios = mock(PortfolioRepository.class);
        HoldingRepository holdings = mock(HoldingRepository.class);
        FrankfurterRateService fx = mock(FrankfurterRateService.class);

        Portfolio portfolio = mock(Portfolio.class);
        when(portfolio.getCurrency()).thenReturn("INR");
        when(portfolios.findById(1L)).thenReturn(Optional.of(portfolio));

        Asset asset = new Asset(
                "USDDEMO",
                "USD Demo Asset",
                new BigDecimal("25.00"),
                "USD"
        );

        Holding holding = new Holding(
                portfolio,
                asset,
                new BigDecimal("10"),
                new BigDecimal("20.00")
        );

        when(holdings.findByPortfolioId(1L))
                .thenReturn(List.of(holding));

        when(fx.getLatestRate("USD", "INR"))
                .thenReturn(new ExchangeRate(
                        LocalDate.now(),
                        "USD",
                        "INR",
                        new BigDecimal("95.00")
                ));

        HoldingResponse result = createService(
                portfolios, holdings, fx
        ).getHoldings(1L).get(0);

        // Original USD value must remain unchanged
        assertEquals(
                0,
                new BigDecimal("250.00")
                        .compareTo(result.marketValue())
        );

        // INR reporting value: 250 * 95 = 23750
        assertEquals(
                0,
                new BigDecimal("23750.0000")
                        .compareTo(result.marketValueInPortfolioCurrency())
        );

        // Existing unrealized P/L remains in USD
        assertEquals(
                0,
                new BigDecimal("50.00")
                        .compareTo(result.unrealizedProfitLoss())
        );

        assertEquals("USD", result.currency());
        assertEquals("INR", result.portfolioCurrency());

        verify(fx).getLatestRate("USD", "INR");
    }
}