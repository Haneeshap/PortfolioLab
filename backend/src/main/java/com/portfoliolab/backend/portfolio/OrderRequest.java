package com.portfoliolab.backend.portfolio;

import java.math.BigDecimal;

public record OrderRequest(
        Long assetId,
        String type,
        BigDecimal quantity
) {
}