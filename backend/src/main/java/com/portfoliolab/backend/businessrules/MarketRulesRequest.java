package com.portfoliolab.backend.businessrules;

import java.math.BigDecimal;

public record MarketRulesRequest(
        String market,
        String side,
        long quantity,
        BigDecimal price,
        BigDecimal availableCash,
        Long availableShares,
        BigDecimal estimatedCharges,
        BigDecimal lowerPriceLimit,
        BigDecimal upperPriceLimit,
        Long quantityIncrement
) {}