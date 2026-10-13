package com.portfoliolab.backend.bonus;

import java.math.BigInteger;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BonusSimulationServiceTest {

    private final BonusSimulationService service =
            new BonusSimulationService();

    @Test
    void calculatesOneForTwoBonus() {
        var result = service.simulate(
                BigInteger.valueOf(100),
                BigInteger.ONE,
                BigInteger.TWO
        );

        assertEquals(BigInteger.valueOf(50), result.additionalShares());
        assertEquals(BigInteger.valueOf(150), result.totalShares());
    }

    @Test
    void calculatesOneForOneBonus() {
        var result = service.simulate(
                BigInteger.valueOf(25),
                BigInteger.ONE,
                BigInteger.ONE
        );

        assertEquals(BigInteger.valueOf(25), result.additionalShares());
        assertEquals(BigInteger.valueOf(50), result.totalShares());
    }

    @Test
    void rejectsFractionalShares() {
        assertThrows(IllegalArgumentException.class,
                () -> service.simulate(
                        BigInteger.valueOf(5),
                        BigInteger.ONE,
                        BigInteger.TWO));
    }

    @Test
    void rejectsNegativeShares() {
        assertThrows(IllegalArgumentException.class,
                () -> service.simulate(
                        BigInteger.valueOf(-10),
                        BigInteger.ONE,
                        BigInteger.TWO));
    }

    @Test
    void rejectsZeroRatio() {
        assertThrows(IllegalArgumentException.class,
                () -> service.simulate(
                        BigInteger.TEN,
                        BigInteger.ZERO,
                        BigInteger.TWO));
    }

    @Test
    void allowsZeroExistingShares() {
        var result = service.simulate(
                BigInteger.ZERO,
                BigInteger.ONE,
                BigInteger.TWO
        );

        assertEquals(BigInteger.ZERO, result.totalShares());
    }
}