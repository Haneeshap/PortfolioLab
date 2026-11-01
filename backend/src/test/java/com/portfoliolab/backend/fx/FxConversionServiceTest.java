package com.portfoliolab.backend.fx;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FxConversionServiceTest {

    private FxRateRepository repository;
    private FxConversionService service;

    @BeforeEach
    void setUp() {
        repository = mock(FxRateRepository.class);
        service = new FxConversionService(repository);

        when(repository.findFirstByBaseCurrencyAndQuoteCurrencyOrderByCapturedAtDescIdDesc(
                anyString(), anyString()
        )).thenAnswer(invocation -> {
            String from = invocation.getArgument(0);
            String to = invocation.getArgument(1);

            if (from.equals("USD") && to.equals("INR")) {
                return Optional.of(rate("USD", "INR", "85"));
            }

            if (from.equals("EUR") && to.equals("INR")) {
                return Optional.of(rate("EUR", "INR", "92"));
            }

            return Optional.empty();
        });
    }

    private FxRate rate(String from, String to, String value) {
        FxRate result = new FxRate();

        try {
            var baseField = FxRate.class.getDeclaredField("baseCurrency");
            var quoteField = FxRate.class.getDeclaredField("quoteCurrency");
            var rateField = FxRate.class.getDeclaredField("rate");
            var sourceField = FxRate.class.getDeclaredField("source");
            var timeField = FxRate.class.getDeclaredField("capturedAt");

            baseField.setAccessible(true);
            quoteField.setAccessible(true);
            rateField.setAccessible(true);
            sourceField.setAccessible(true);
            timeField.setAccessible(true);

            baseField.set(result, from);
            quoteField.set(result, to);
            rateField.set(result, new BigDecimal(value));
            sourceField.set(result, "SIMULATED");
            timeField.set(result, Instant.now());
        } catch (ReflectiveOperationException exception) {
            throw new RuntimeException(exception);
        }

        return result;
    }

    @Test
    void directConversion() {
        var response = service.convert("USD", "INR", new BigDecimal("100"));

        assertEquals(0, response.convertedAmount()
                .compareTo(new BigDecimal("8500")));
    }


    @Test
    void reverseConversion() {
        var response = service.convert("INR", "USD", new BigDecimal("8500"));

        assertEquals(0, response.convertedAmount()
                .compareTo(new BigDecimal("100")));
    }

    @Test
    void crossCurrencyConversion() {
        var response = service.convert("USD", "EUR", new BigDecimal("100"));

        assertEquals(0, response.convertedAmount()
                .compareTo(new BigDecimal("92.3913")));
    }

    @Test
    void missingConversionPath() {
        var exception = assertThrows(
            ResponseStatusException.class,
            () -> service.convert("GBP", "JPY", new BigDecimal("100"))
        );

        assertEquals(404, exception.getStatusCode().value());
    }

    @Test
    void invalidAmount() {
        var exception = assertThrows(
            ResponseStatusException.class,
            () -> service.convert("USD", "INR", BigDecimal.ZERO)
        );

        assertEquals(400, exception.getStatusCode().value());
    }
}