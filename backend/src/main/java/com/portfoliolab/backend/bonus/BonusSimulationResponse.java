package com.portfoliolab.backend.bonus;

import java.math.BigInteger;

public record BonusSimulationResponse(
        BigInteger existingShares,
        BigInteger bonusShares,
        BigInteger requiredShares,
        BigInteger additionalShares,
        BigInteger totalShares,
        String calculation,
        String disclaimer
) {}