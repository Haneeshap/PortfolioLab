package com.portfoliolab.backend.bonus;

import java.math.BigInteger;
import org.springframework.stereotype.Service;

@Service
public class BonusSimulationService {

    public BonusResult simulate(
            BigInteger existingShares,
            BigInteger bonusShares,
            BigInteger requiredShares) {

        if (existingShares == null ||
                bonusShares == null ||
                requiredShares == null) {
            throw new IllegalArgumentException("All inputs are required");
        }

        if (existingShares.signum() < 0) {
            throw new IllegalArgumentException(
                    "Existing shares cannot be negative");
        }

        if (bonusShares.signum() <= 0 ||
                requiredShares.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Bonus ratio values must be positive");
        }

        BigInteger numerator = existingShares.multiply(bonusShares);
        BigInteger[] division = numerator.divideAndRemainder(requiredShares);

        if (division[1].signum() != 0) {
            throw new IllegalArgumentException(
                    "Fractional bonus shares are not supported");
        }

        BigInteger additionalShares = division[0];
        BigInteger totalShares = existingShares.add(additionalShares);

        return new BonusResult(
                existingShares,
                bonusShares,
                requiredShares,
                additionalShares,
                totalShares
        );
    }

    public record BonusResult(
            BigInteger existingShares,
            BigInteger bonusShares,
            BigInteger requiredShares,
            BigInteger additionalShares,
            BigInteger totalShares
    ) {}
}