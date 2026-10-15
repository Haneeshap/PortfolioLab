package com.portfoliolab.backend.portfolio;


import com.portfoliolab.backend.notification.NotificationOutbox;
import com.portfoliolab.backend.fx.FrankfurterRateService;
import com.portfoliolab.backend.asset.AssetRepository;
import com.portfoliolab.backend.market.MarketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import com.portfoliolab.backend.asset.Asset;
import com.portfoliolab.backend.market.MarketPrice;
import com.portfoliolab.backend.fx.FrankfurterRateService.ExchangeRate;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
class OrderServiceTest {

    private OrderService orderService;

@BeforeEach
void setUp() {
    orderService = new OrderService(
            mock(PortfolioRepository.class),
            mock(AssetRepository.class),
            mock(HoldingRepository.class),
            mock(TransactionRepository.class),
            new OrderPricingService(mock(MarketService.class), mock(FrankfurterRateService.class)), org.mockito.Mockito.mock(com.portfoliolab.backend.risk.PreTradeRiskService.class), org.mockito.Mockito.mock(NotificationOutbox.class), org.mockito.Mockito.mock(org.springframework.context.ApplicationEventPublisher.class));
}

    @Test
    void rejectsInvalidOrderType() {
        OrderRequest request = new OrderRequest(
                1L, "TRANSFER", BigDecimal.TEN
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> orderService.placeOrder(1L, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    @Test
    void rejectsZeroQuantity() {
        OrderRequest request = new OrderRequest(
                1L, "BUY", BigDecimal.ZERO
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> orderService.placeOrder(1L, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    @Test
    void rejectsFractionalQuantity() {
        OrderRequest request = new OrderRequest(
                1L, "BUY", new BigDecimal("1.5")
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> orderService.placeOrder(1L, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    @Test
    void rejectsMissingAssetId() {
        OrderRequest request = new OrderRequest(
                null, "BUY", BigDecimal.ONE
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> orderService.placeOrder(1L, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

@Test
    void convertsUsdPurchaseIntoInrCash() {
    Portfolio portfolio = mock(Portfolio.class);
    Asset asset = new Asset(
            "USDDEMO",
            "USD Demo Asset",
            new BigDecimal("20.00"),
            "USD"
    );

    PortfolioRepository portfolios = mock(PortfolioRepository.class);
    AssetRepository assets = mock(AssetRepository.class);
    HoldingRepository holdings = mock(HoldingRepository.class);
    TransactionRepository transactions = mock(TransactionRepository.class);
    MarketService market = mock(MarketService.class);
    FrankfurterRateService fx = mock(FrankfurterRateService.class);

    OrderService service = new OrderService(
            portfolios, assets, holdings, transactions, new OrderPricingService(market, fx), org.mockito.Mockito.mock(com.portfoliolab.backend.risk.PreTradeRiskService.class), org.mockito.Mockito.mock(NotificationOutbox.class), org.mockito.Mockito.mock(org.springframework.context.ApplicationEventPublisher.class));

    when(portfolios.findByIdForUpdate(1L))
            .thenReturn(Optional.of(portfolio));
    when(portfolio.getCurrency()).thenReturn("INR");
    when(portfolio.getCashBalance())
            .thenReturn(new BigDecimal("50000.0000"));

    when(assets.findById(2L)).thenReturn(Optional.of(asset));

    when(market.getCurrentPrices()).thenReturn(List.of(
            new MarketPrice(
                    "USDDEMO",
                    new BigDecimal("20.00"),
                    "USD",
                    Instant.now()
            )
    ));

    when(fx.getLatestRate("USD", "INR")).thenReturn(
            new ExchangeRate(
                    LocalDate.now(),
                    "USD",
                    "INR",
                    new BigDecimal("95.00")
            )
    );

    OrderResponse result = service.placeOrder(
            1L,
            new OrderRequest(2L, "BUY", BigDecimal.TEN)
    );

    assertEquals(
            0,
            new BigDecimal("19000.0000")
                    .compareTo(result.portfolioAmount())
    );

    assertEquals(
            0,
            new BigDecimal("95.00000000")
                    .compareTo(result.executionFxRate())
    );

    verify(portfolio).setCashBalance(
            new BigDecimal("31000.0000")
    );
}

    @Test
    void rejectsOrderWhenFxProviderFails() {
        Portfolio portfolio = mock(Portfolio.class);
        Asset asset = new Asset(
                "USDDEMO",
                "USD Demo Asset",
                new BigDecimal("20.00"),
                "USD"
        );

        PortfolioRepository portfolios = mock(PortfolioRepository.class);
        AssetRepository assets = mock(AssetRepository.class);
        HoldingRepository holdings = mock(HoldingRepository.class);
        TransactionRepository transactions = mock(TransactionRepository.class);
        MarketService market = mock(MarketService.class);
        FrankfurterRateService fx = mock(FrankfurterRateService.class);

        OrderService service = new OrderService(
                portfolios, assets, holdings, transactions, new OrderPricingService(market, fx), org.mockito.Mockito.mock(com.portfoliolab.backend.risk.PreTradeRiskService.class), org.mockito.Mockito.mock(NotificationOutbox.class), org.mockito.Mockito.mock(org.springframework.context.ApplicationEventPublisher.class));

        when(portfolios.findByIdForUpdate(1L))
                .thenReturn(java.util.Optional.of(portfolio));
        when(portfolio.getCurrency()).thenReturn("INR");
        when(assets.findById(2L))
                .thenReturn(java.util.Optional.of(asset));

        when(market.getCurrentPrices()).thenReturn(java.util.List.of(
                new com.portfoliolab.backend.market.MarketPrice(
                        "USDDEMO",
                        new BigDecimal("20.00"),
                        "USD",
                        java.time.Instant.now()
                )
        ));

        when(fx.getLatestRate("USD", "INR"))
                .thenThrow(new IllegalStateException("Provider unavailable"));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.placeOrder(
                        1L,
                        new OrderRequest(2L, "BUY", BigDecimal.TEN)
                )
        );

        assertEquals(
                HttpStatus.SERVICE_UNAVAILABLE,
                exception.getStatusCode()
        );

        org.mockito.Mockito.verify(portfolio, org.mockito.Mockito.never())
                .setCashBalance(org.mockito.ArgumentMatchers.any());

        org.mockito.Mockito.verify(transactions, org.mockito.Mockito.never())
                .save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rejectsForeignPurchaseWithInsufficientCash() {
        Portfolio portfolio = mock(Portfolio.class);
        Asset asset = new Asset(
                "USDDEMO",
                "USD Demo Asset",
                new BigDecimal("20.00"),
                "USD"
        );

        PortfolioRepository portfolios = mock(PortfolioRepository.class);
        AssetRepository assets = mock(AssetRepository.class);
        HoldingRepository holdings = mock(HoldingRepository.class);
        TransactionRepository transactions = mock(TransactionRepository.class);
        MarketService market = mock(MarketService.class);
        FrankfurterRateService fx = mock(FrankfurterRateService.class);

        OrderService service = new OrderService(
                portfolios, assets, holdings, transactions, new OrderPricingService(market, fx), org.mockito.Mockito.mock(com.portfoliolab.backend.risk.PreTradeRiskService.class), org.mockito.Mockito.mock(NotificationOutbox.class), org.mockito.Mockito.mock(org.springframework.context.ApplicationEventPublisher.class));

        when(portfolios.findByIdForUpdate(1L))
                .thenReturn(java.util.Optional.of(portfolio));
        when(portfolio.getCurrency()).thenReturn("INR");
        when(portfolio.getCashBalance())
                .thenReturn(new BigDecimal("10000.0000"));
        when(assets.findById(2L))
                .thenReturn(java.util.Optional.of(asset));

        when(market.getCurrentPrices()).thenReturn(java.util.List.of(
                new MarketPrice(
                        "USDDEMO",
                        new BigDecimal("20.00"),
                        "USD",
                        java.time.Instant.now()
                )
        ));

        when(fx.getLatestRate("USD", "INR"))
                .thenReturn(new ExchangeRate(
                        java.time.LocalDate.now(),
                        "USD",
                        "INR",
                        new BigDecimal("95.00")
                ));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.placeOrder(
                        1L,
                        new OrderRequest(2L, "BUY", BigDecimal.TEN)
                )
        );

        assertEquals(
                HttpStatus.BAD_REQUEST,
                exception.getStatusCode()
        );

        org.mockito.Mockito.verify(portfolio, org.mockito.Mockito.never())
                .setCashBalance(org.mockito.ArgumentMatchers.any());

        org.mockito.Mockito.verify(transactions, org.mockito.Mockito.never())
                .save(org.mockito.ArgumentMatchers.any());

        org.mockito.Mockito.verify(holdings, org.mockito.Mockito.never())
                .save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void inrPurchaseDoesNotCallFxProvider() {
        Portfolio portfolio = mock(Portfolio.class);
        Asset asset = new Asset(
                "INRDEMO",
                "INR Demo Asset",
                new BigDecimal("100.00"),
                "INR"
        );

        PortfolioRepository portfolios = mock(PortfolioRepository.class);
        AssetRepository assets = mock(AssetRepository.class);
        HoldingRepository holdings = mock(HoldingRepository.class);
        TransactionRepository transactions = mock(TransactionRepository.class);
        MarketService market = mock(MarketService.class);
        FrankfurterRateService fx = mock(FrankfurterRateService.class);

        OrderService service = new OrderService(
                portfolios, assets, holdings, transactions, new OrderPricingService(market, fx), org.mockito.Mockito.mock(com.portfoliolab.backend.risk.PreTradeRiskService.class), org.mockito.Mockito.mock(NotificationOutbox.class), org.mockito.Mockito.mock(org.springframework.context.ApplicationEventPublisher.class));

        when(portfolios.findByIdForUpdate(1L))
                .thenReturn(java.util.Optional.of(portfolio));
        when(portfolio.getCurrency()).thenReturn("INR");
        when(portfolio.getCashBalance())
                .thenReturn(new BigDecimal("5000.0000"));
        when(assets.findById(3L))
                .thenReturn(java.util.Optional.of(asset));

        when(market.getCurrentPrices()).thenReturn(java.util.List.of(
                new MarketPrice(
                        "INRDEMO",
                        new BigDecimal("100.00"),
                        "INR",
                        java.time.Instant.now()
                )
        ));

        OrderResponse result = service.placeOrder(
                1L,
                new OrderRequest(3L, "BUY", BigDecimal.TEN)
        );

        assertEquals(
                0,
                BigDecimal.ONE.compareTo(result.executionFxRate())
        );

        assertEquals(
                0,
                new BigDecimal("1000.0000")
                        .compareTo(result.portfolioAmount())
        );

        org.mockito.Mockito.verifyNoInteractions(fx);

        org.mockito.Mockito.verify(portfolio)
                .setCashBalance(new BigDecimal("4000.0000"));
    }
}