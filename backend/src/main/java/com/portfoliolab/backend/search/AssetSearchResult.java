package com.portfoliolab.backend.search;

public record AssetSearchResult(
        Long assetId,
        String symbol,
        String name,
        String sector,
        String description,
        double similarity
) {
}