package com.portfoliolab.backend.portfolio;

import java.math.BigDecimal;

public record PortfolioResponse(
        Long id,
        String name,
        BigDecimal cashBalance,
        String currency
) {
}