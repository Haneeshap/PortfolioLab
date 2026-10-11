package com.portfoliolab.backend.asset;

import java.math.BigDecimal;

public record AssetResponse(
    Long id,
    String symbol,
    String name,
    BigDecimal price,
    String currency
) {
    public static AssetResponse from(Asset asset) {
        return new AssetResponse(
            asset.getId(),
            asset.getSymbol(),
            asset.getName(),
            asset.getPrice(),
            asset.getCurrency()
        );
    }
}