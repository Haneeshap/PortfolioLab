package com.portfoliolab.backend.dividend;

import java.math.BigDecimal;

public record DividendSimulationResponse(
        BigDecimal eligibleShares,
        BigDecimal dividendPerShare,
        BigDecimal grossDividend,
        String currency,
        String calculation,
        String disclaimer
) {
}
