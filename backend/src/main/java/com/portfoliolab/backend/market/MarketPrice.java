
package com.portfoliolab.backend.market;

import java.math.BigDecimal;
import java.time.Instant;

public record MarketPrice(
        String symbol,
        BigDecimal price,
        String currency,
        Instant updatedAt
) {
}
