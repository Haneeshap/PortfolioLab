package com.portfoliolab.backend.bonus;

import java.math.BigInteger;

public record BonusSimulationRequest(
        BigInteger existingShares,
        BigInteger bonusShares,
        BigInteger requiredShares
) {}