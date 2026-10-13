package com.portfoliolab.backend.dividend;

import java.math.BigDecimal;

public record DividendSimulationRequest(
        BigDecimal eligibleShares,
        BigDecimal dividendPerShare,
        String currency
) {
}
