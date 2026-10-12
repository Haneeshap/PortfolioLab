package com.portfoliolab.backend.fx;

import java.math.BigDecimal;

public record FxConversionResponse(
    String fromCurrency,
    String toCurrency,
    BigDecimal originalAmount,
    BigDecimal convertedAmount,
    BigDecimal effectiveRate,
    String rateSource
) {}