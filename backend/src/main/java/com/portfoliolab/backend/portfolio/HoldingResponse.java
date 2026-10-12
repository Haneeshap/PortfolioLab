package com.portfoliolab.backend.portfolio;

import java.math.BigDecimal;

public record HoldingResponse(
        Long assetId,
        String symbol,
        String name,
        BigDecimal quantity,
        BigDecimal averageBuyPrice,
        BigDecimal currentPrice,
        BigDecimal marketValue,
        BigDecimal unrealizedProfitLoss,
        String currency
) {
}