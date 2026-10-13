
package com.portfoliolab.backend.dividend;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Service;

@Service
public class DividendSimulationService {

    public BigDecimal calculateGrossDividend(
            BigDecimal eligibleShares,
            BigDecimal dividendPerShare) {

        if (eligibleShares == null || dividendPerShare == null) {
            throw new IllegalArgumentException(
                    "Share quantity and dividend per share are required"
            );
        }

        if (eligibleShares.signum() < 0) {
            throw new IllegalArgumentException(
                    "Eligible shares cannot be negative"
            );
        }

        if (dividendPerShare.signum() < 0) {
            throw new IllegalArgumentException(
                    "Dividend per share cannot be negative"
            );
        }

        if (eligibleShares.stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException(
                    "Eligible shares must be a whole number"
            );
        }

        return eligibleShares
                .multiply(dividendPerShare)
                .setScale(2, RoundingMode.HALF_UP);
    }
}
