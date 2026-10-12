package com.portfoliolab.backend.portfolio;

import java.math.BigDecimal;
import java.time.Instant;

public record TransactionResponse(
        Long id,
        String assetSymbol,
        String type,
        BigDecimal quantity,
        BigDecimal pricePerUnit,
        BigDecimal totalAmount,
        String currency,
        Instant createdAt
) {
}