package com.portfoliolab.backend.portfolio;

import java.math.BigDecimal;

public record OrderResponse(
        Long transactionId,
        Long portfolioId,
        String assetSymbol,
        String type,
        BigDecimal quantity,
        BigDecimal pricePerUnit,
        BigDecimal totalAmount,
        String currency,
        BigDecimal remainingCashBalance
) {
}