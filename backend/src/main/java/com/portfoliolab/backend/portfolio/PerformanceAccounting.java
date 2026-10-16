package com.portfoliolab.backend.portfolio;

import java.math.*;
import java.time.Instant;
import java.util.*;

/** Settled transactions only: execution receipts reference these same rows. */
public final class PerformanceAccounting {
    private PerformanceAccounting() {}
    public record Fill(long assetId, String symbol, String side, BigDecimal quantity,
                       BigDecimal amount, Instant time) {}
    public record Position(BigDecimal quantity, BigDecimal cost, BigDecimal realized) {}
    public static BigDecimal money(BigDecimal value) { return value.setScale(4, RoundingMode.HALF_UP); }
    public static BigDecimal pct(BigDecimal value, BigDecimal total) {
        return total.signum() <= 0 ? null : value.multiply(new BigDecimal("100")).divide(total, 6, RoundingMode.HALF_UP);
    }
    public static Map<Long, Position> replay(List<Fill> fills) {
        Map<Long, Position> result = new TreeMap<>();
        for (Fill f : fills) {
            Position p = result.getOrDefault(f.assetId(), new Position(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
            if (f.quantity().signum() <= 0 || f.amount().signum() <= 0) throw new IllegalArgumentException("Invalid settled transaction");
            if (f.side().equals("BUY")) {
                result.put(f.assetId(), new Position(p.quantity().add(f.quantity()), p.cost().add(f.amount()), p.realized()));
            } else if (f.side().equals("SELL") && p.quantity().compareTo(f.quantity()) >= 0) {
                BigDecimal remaining = p.quantity().subtract(f.quantity());
                BigDecimal cost = remaining.signum() == 0 ? BigDecimal.ZERO : p.cost().multiply(remaining).divide(p.quantity(), 4, RoundingMode.HALF_UP);
                result.put(f.assetId(), new Position(remaining, cost, p.realized().add(f.amount()).subtract(p.cost().subtract(cost))));
            } else throw new IllegalArgumentException("Incomplete or invalid position history");
        }
        return result;
    }
    public static BigDecimal contribution(BigDecimal opening, BigDecimal closing, BigDecimal buys, BigDecimal sells, BigDecimal dividends) {
        return money(closing.subtract(opening).subtract(buys).add(sells).add(dividends));
    }
}
