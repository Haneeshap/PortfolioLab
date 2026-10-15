package com.portfoliolab.backend.portfolio;


import com.portfoliolab.backend.notification.NotificationOutbox;
import com.portfoliolab.backend.asset.Asset;
import com.portfoliolab.backend.asset.AssetRepository;
import com.portfoliolab.backend.fx.FrankfurterRateService;
import com.portfoliolab.backend.fx.FrankfurterRateService.ExchangeRate;
import com.portfoliolab.backend.market.MarketPrice;
import com.portfoliolab.backend.market.MarketService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OrderServicePartialSaleTest {

    @Test
    void partialSalePreservesHistoricalFxCostBasis() {
        Portfolio portfolio = mock(Portfolio.class);

        when(portfolio.getCurrency()).thenReturn("INR");
        when(portfolio.getCashBalance())
                .thenReturn(new BigDecimal("5000.0000"));

        Asset asset = new Asset(
                "USDTEST",
                "USD Test Asset",
                new BigDecimal("25.00"),
                "USD"
        );

        Holding holding = new Holding(
                portfolio,
                asset,
                new BigDecimal("10"),
                new BigDecimal("20.00")
        );

        holding.setHistoricalCostPortfolio(
                new BigDecimal("17000.0000")
        );

        PortfolioRepository portfolios =
                mock(PortfolioRepository.class);

        AssetRepository assets =
                mock(AssetRepository.class);

        HoldingRepository holdings =
                mock(HoldingRepository.class);

        TransactionRepository transactions =
                mock(TransactionRepository.class);

        MarketService market =
                mock(MarketService.class);

        FrankfurterRateService fx =
                mock(FrankfurterRateService.class);

        when(portfolios.findByIdForUpdate(1L))
                .thenReturn(Optional.of(portfolio));

        when(assets.findById(2L))
                .thenReturn(Optional.of(asset));

        when(holdings.findByPortfolioIdAndAssetId(1L, null))
                .thenReturn(Optional.of(holding));

        when(market.getCurrentPrices())
                .thenReturn(List.of(new MarketPrice(
                        "USDTEST",
                        new BigDecimal("25.00"),
                        "USD",
                        Instant.now()
                )));

        when(fx.getLatestRate("USD", "INR"))
                .thenReturn(new ExchangeRate(
                        LocalDate.now(),
                        "USD",
                        "INR",
                        new BigDecimal("90.00")
                ));

        OrderService service = new OrderService(
                portfolios,
                assets,
                holdings,
                transactions, new OrderPricingService(market, fx), org.mockito.Mockito.mock(NotificationOutbox.class), org.mockito.Mockito.mock(org.springframework.context.ApplicationEventPublisher.class));

        OrderResponse response = service.placeOrder(
                1L,
                new OrderRequest(
                        2L,
                        "SELL",
                        new BigDecimal("4")
                )
        );

        assertEquals(
                0,
                new BigDecimal("6")
                        .compareTo(holding.getQuantity())
        );

        assertEquals(
                0,
                new BigDecimal("10200.0000")
                        .compareTo(
                                holding.getHistoricalCostPortfolio()
                        )
        );

        assertEquals(
                0,
                new BigDecimal("20.00")
                        .compareTo(holding.getAverageBuyPrice())
        );

        assertEquals(
                0,
                new BigDecimal("9000.0000")
                        .compareTo(response.portfolioAmount())
        );

        verify(portfolio).setCashBalance(
                new BigDecimal("14000.0000")
        );

        verify(holdings, never()).delete(any(Holding.class));
        verify(transactions).saveAndFlush(any(Transaction.class));
    }
}