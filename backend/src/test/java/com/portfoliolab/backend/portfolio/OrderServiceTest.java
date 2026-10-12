package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.AssetRepository;
import com.portfoliolab.backend.market.MarketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class OrderServiceTest {

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(
                mock(PortfolioRepository.class),
                mock(AssetRepository.class),
                mock(HoldingRepository.class),
                mock(TransactionRepository.class),
                mock(MarketService.class)
        );
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
}