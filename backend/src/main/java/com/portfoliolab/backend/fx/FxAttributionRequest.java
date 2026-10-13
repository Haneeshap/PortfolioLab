package com.portfoliolab.backend.fx;

import java.math.BigDecimal;

public record FxAttributionRequest(
    BigDecimal quantity,
    BigDecimal purchasePrice,
    BigDecimal currentPrice,
    BigDecimal purchaseFxRate,
    BigDecimal currentFxRate
) {}