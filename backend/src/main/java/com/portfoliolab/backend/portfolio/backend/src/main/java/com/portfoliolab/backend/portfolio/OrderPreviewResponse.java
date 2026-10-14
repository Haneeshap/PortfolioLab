package com.portfoliolab.backend.portfolio;

import java.math.BigDecimal;

public record OrderPreviewResponse(
        String assetSymbol,
        String side,
        BigDecimal quantity,
        BigDecimal estimatedPrice,
        String assetCurrency,
        BigDecimal estimatedAssetTotal,
        BigDecimal fxRate,
        BigDecimal estimatedPortfolioTotal,
        String portfolioCurrency,
        BigDecimal availableCash,
        BigDecimal estimatedCharges,
        Boolean sufficientCash,
        String disclaimer
) {}