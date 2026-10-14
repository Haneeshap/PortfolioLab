package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.Asset;
import com.portfoliolab.backend.asset.AssetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OrderPreviewServiceTest {

    private PortfolioRepository portfolios;
    private AssetRepository assets;
    private OrderPricingService pricing;
    private OrderPreviewService service;

    @BeforeEach
    void setUp() {
        portfolios = mock(PortfolioRepository.class);
        assets = mock(AssetRepository.class);
        pricing = mock(OrderPricingService.class);

        service = new OrderPreviewService(
                portfolios,
                assets,
                pricing
        );
    }

    private Portfolio mockPortfolio(
            String currency,
            String cashBalance
    ) {
        Portfolio portfolio = mock(Portfolio.class);

        when(portfolio.getCurrency()).thenReturn(currency);
        when(portfolio.getCashBalance())
                .thenReturn(new BigDecimal(cashBalance));

        return portfolio;
    }

    private void prepare(
            Portfolio portfolio,
            Asset asset,
            OrderPricingService.Pricing result
    ) {
        when(portfolios.findById(1L))
                .thenReturn(Optional.of(portfolio));

        when(assets.findById(2L))
                .thenReturn(Optional.of(asset));

        when(pricing.calculate(
                eq(asset),
                eq(portfolio),
                any(BigDecimal.class)
        )).thenReturn(result);
    }

    @Test
    void sameCurrencyBuyHasSufficientCash() {
        Portfolio portfolio = mockPortfolio("INR", "1000.0000");

        Asset asset = new Asset(
                "INRDEMO",
                "INR Demo",
                new BigDecimal("100.0000"),
                "INR"
        );

        prepare(
                portfolio,
                asset,
                new OrderPricingService.Pricing(
                        new BigDecimal("100.0000"),
                        new BigDecimal("200.0000"),
                        new BigDecimal("1.00000000"),
                        new BigDecimal("200.0000")
                )
        );

        OrderPreviewResponse result = service.preview(
                1L,
                new OrderRequest(2L, "BUY", new BigDecimal("2"))
        );

        assertEquals("INR", result.assetCurrency());
        assertEquals("INR", result.portfolioCurrency());

        assertEquals(
                0,
                result.fxRate().compareTo(BigDecimal.ONE)
        );

        assertEquals(
                0,
                result.estimatedPortfolioTotal()
                        .compareTo(new BigDecimal("200"))
        );

        assertEquals(Boolean.TRUE, result.sufficientCash());

        verify(pricing).calculate(
                eq(asset),
                eq(portfolio),
                eq(new BigDecimal("2"))
        );
    }

    @Test
    void crossCurrencyBuyDetectsInsufficientCash() {
        Portfolio portfolio = mockPortfolio("INR", "3000.0000");

        Asset asset = new Asset(
                "USDDEMO",
                "USD Demo",
                new BigDecimal("25.0000"),
                "USD"
        );

        prepare(
                portfolio,
                asset,
                new OrderPricingService.Pricing(
                        new BigDecimal("25.0000"),
                        new BigDecimal("50.0000"),
                        new BigDecimal("90.00000000"),
                        new BigDecimal("4500.0000")
                )
        );

        OrderPreviewResponse result = service.preview(
                1L,
                new OrderRequest(2L, "BUY", new BigDecimal("2"))
        );

        assertEquals("USD", result.assetCurrency());
        assertEquals("INR", result.portfolioCurrency());

        assertEquals(
                0,
                result.estimatedAssetTotal()
                        .compareTo(new BigDecimal("50"))
        );

        assertEquals(
                0,
                result.estimatedPortfolioTotal()
                        .compareTo(new BigDecimal("4500"))
        );

        assertEquals(Boolean.FALSE, result.sufficientCash());
    }

    @Test
    void sellPreviewDoesNotReportBuyingPower() {
        Portfolio portfolio = mockPortfolio("INR", "1000.0000");

        Asset asset = new Asset(
                "INRDEMO",
                "INR Demo",
                new BigDecimal("100.0000"),
                "INR"
        );

        prepare(
                portfolio,
                asset,
                new OrderPricingService.Pricing(
                        new BigDecimal("100.0000"),
                        new BigDecimal("100.0000"),
                        new BigDecimal("1.00000000"),
                        new BigDecimal("100.0000")
                )
        );

        OrderPreviewResponse result = service.preview(
                1L,
                new OrderRequest(2L, "SELL", BigDecimal.ONE)
        );

        assertNull(result.sufficientCash());
        assertEquals("SELL", result.side());
    }

    @Test
    void rejectsFractionalQuantityBeforeRepositoryAccess() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.preview(
                        1L,
                        new OrderRequest(
                                2L,
                                "BUY",
                                new BigDecimal("1.5")
                        )
                )
        );

        assertEquals(
                HttpStatus.BAD_REQUEST,
                exception.getStatusCode()
        );

        verifyNoInteractions(portfolios, assets, pricing);
    }

    @Test
    void previewOnlyReadsRepositoriesAndCalculatesPricing() {
        Portfolio portfolio = mockPortfolio("INR", "1000.0000");

        Asset asset = new Asset(
                "INRDEMO",
                "INR Demo",
                new BigDecimal("100.0000"),
                "INR"
        );

        prepare(
                portfolio,
                asset,
                new OrderPricingService.Pricing(
                        new BigDecimal("100.0000"),
                        new BigDecimal("100.0000"),
                        new BigDecimal("1.00000000"),
                        new BigDecimal("100.0000")
                )
        );

        service.preview(
                1L,
                new OrderRequest(2L, "BUY", BigDecimal.ONE)
        );

        verify(portfolios).findById(1L);
        verify(assets).findById(2L);

        verify(pricing).calculate(
                eq(asset),
                eq(portfolio),
                eq(BigDecimal.ONE)
        );

        verifyNoMoreInteractions(portfolios, assets, pricing);
    }
}