package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.Asset;
import com.portfoliolab.backend.fx.FrankfurterRateService;
import com.portfoliolab.backend.fx.FrankfurterRateService.ExchangeRate;
import com.portfoliolab.backend.market.MarketPrice;
import com.portfoliolab.backend.market.MarketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OrderPricingServiceTest {

    private MarketService market;
    private FrankfurterRateService fx;
    private OrderPricingService service;

    @BeforeEach
    void setUp() {
        market = mock(MarketService.class);
        fx = mock(FrankfurterRateService.class);
        service = new OrderPricingService(market, fx);
    }

    private Portfolio portfolio(String currency) {
        Portfolio portfolio = mock(Portfolio.class);
        when(portfolio.getCurrency()).thenReturn(currency);
        return portfolio;
    }

    private Asset asset(String currency) {
        return new Asset(
                "DEMO",
                "Demo Asset",
                new BigDecimal("20.0000"),
                currency
        );
    }

    private void quote(
            String currency,
            String price,
            Instant updatedAt
    ) {
        when(market.getCurrentPrices()).thenReturn(List.of(
                new MarketPrice(
                        "DEMO",
                        new BigDecimal(price),
                        currency,
                        updatedAt
                )
        ));
    }

    @Test
    void sameCurrencyUsesIdentityFxRate() {
        Asset asset = asset("INR");
        Portfolio portfolio = portfolio("INR");

        quote("INR", "20.0000", Instant.now());

        OrderPricingService.Pricing result =
                service.calculate(
                        asset,
                        portfolio,
                        new BigDecimal("3")
                );

        assertEquals(
                0,
                result.fxRate().compareTo(BigDecimal.ONE)
        );

        assertEquals(
                0,
                result.portfolioTotal()
                        .compareTo(new BigDecimal("60"))
        );

        verifyNoInteractions(fx);
    }

    @Test
    void crossCurrencyConvertsUsingReferenceFxRate() {
        Asset asset = asset("USD");
        Portfolio portfolio = portfolio("INR");

        quote("USD", "20.0000", Instant.now());

        when(fx.getLatestRate("USD", "INR"))
                .thenReturn(new ExchangeRate(
                        LocalDate.now(),
                        "USD",
                        "INR",
                        new BigDecimal("90.00000000")
                ));

        OrderPricingService.Pricing result =
                service.calculate(
                        asset,
                        portfolio,
                        new BigDecimal("2")
                );

        assertEquals(
                0,
                result.assetTotal()
                        .compareTo(new BigDecimal("40"))
        );

        assertEquals(
                0,
                result.portfolioTotal()
                        .compareTo(new BigDecimal("3600"))
        );

        verify(fx).getLatestRate("USD", "INR");
    }

    @Test
    void rejectsStaleQuote() {
        Asset asset = asset("INR");
        Portfolio portfolio = portfolio("INR");

        quote(
                "INR",
                "20.0000",
                Instant.now().minusSeconds(120)
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.calculate(
                        asset,
                        portfolio,
                        BigDecimal.ONE
                )
        );

        assertEquals(
                HttpStatus.SERVICE_UNAVAILABLE,
                exception.getStatusCode()
        );

        verifyNoInteractions(fx);
    }

    @Test
    void rejectsQuoteCurrencyMismatch() {
        Asset asset = asset("USD");
        Portfolio portfolio = portfolio("INR");

        quote("INR", "20.0000", Instant.now());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.calculate(
                        asset,
                        portfolio,
                        BigDecimal.ONE
                )
        );

        assertEquals(
                HttpStatus.SERVICE_UNAVAILABLE,
                exception.getStatusCode()
        );

        verifyNoInteractions(fx);
    }

    @Test
    void rejectsNonPositiveFxRate() {
        Asset asset = asset("USD");
        Portfolio portfolio = portfolio("INR");

        quote("USD", "20.0000", Instant.now());

        when(fx.getLatestRate("USD", "INR"))
                .thenReturn(new ExchangeRate(
                        LocalDate.now(),
                        "USD",
                        "INR",
                        BigDecimal.ZERO
                ));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.calculate(
                        asset,
                        portfolio,
                        BigDecimal.ONE
                )
        );

        assertEquals(
                HttpStatus.SERVICE_UNAVAILABLE,
                exception.getStatusCode()
        );
    }
}