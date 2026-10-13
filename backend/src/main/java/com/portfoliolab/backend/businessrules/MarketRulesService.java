package com.portfoliolab.backend.businessrules;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class MarketRulesService {

    public record RuleCheck(
            String code,
            String status,
            String explanation
    ) {}

    public record Evaluation(
            String market,
            String currency,
            String side,
            String overallStatus,
            List<RuleCheck> checks,
            String disclaimer
    ) {}

    public Evaluation evaluate(
            String market,
            String side,
            long quantity,
            BigDecimal price,
            BigDecimal availableCash,
            Long availableShares,
            BigDecimal estimatedCharges,
            BigDecimal lowerPriceLimit,
            BigDecimal upperPriceLimit,
            Long quantityIncrement) {

        if (!List.of("NSE", "BSE", "NYSE", "NASDAQ").contains(market)) {
            throw new IllegalArgumentException("Unsupported market");
        }

        if (!List.of("BUY", "SELL").contains(side)) {
            throw new IllegalArgumentException("Unsupported transaction side");
        }

        if (quantity <= 0 || price == null ||
                price.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Quantity and price must be positive");
        }

        if (availableCash != null && availableCash.signum() < 0 ||
                availableShares != null && availableShares < 0 ||
                estimatedCharges != null && estimatedCharges.signum() < 0 ||
                quantityIncrement != null && quantityIncrement <= 0) {
            throw new IllegalArgumentException("Invalid simulation input");
        }

        if (lowerPriceLimit != null && lowerPriceLimit.signum() <= 0 ||
                upperPriceLimit != null && upperPriceLimit.signum() <= 0 ||
                lowerPriceLimit != null && upperPriceLimit != null &&
                lowerPriceLimit.compareTo(upperPriceLimit) > 0) {
            throw new IllegalArgumentException("Invalid price limits");
        }

        String currency = List.of("NSE", "BSE").contains(market)
                ? "INR" : "USD";

        List<RuleCheck> checks = new ArrayList<>();

        if ("BUY".equals(side)) {
            if (availableCash == null || estimatedCharges == null) {
                checks.add(new RuleCheck(
                        "BUYING_POWER", "NEEDS_DATA",
                        "Available cash and estimated charges are required."
                ));
            } else {
                BigDecimal required = price
                        .multiply(BigDecimal.valueOf(quantity))
                        .add(estimatedCharges);

                boolean passes = availableCash.compareTo(required) >= 0;

                checks.add(new RuleCheck(
                        "BUYING_POWER",
                        passes ? "PASS" : "FAIL",
                        "Required " + currency + " " + required
                                + "; available " + currency + " "
                                + availableCash + "."
                ));
            }
        } else {
            if (availableShares == null) {
                checks.add(new RuleCheck(
                        "SELL_AVAILABILITY", "NEEDS_DATA",
                        "Available delivery shares are required."
                ));
            } else {
                checks.add(new RuleCheck(
                        "SELL_AVAILABILITY",
                        availableShares >= quantity ? "PASS" : "FAIL",
                        "Requested " + quantity
                                + " shares; available "
                                + availableShares + "."
                ));
            }
        }

        if (lowerPriceLimit == null || upperPriceLimit == null) {
            checks.add(new RuleCheck(
                    "PRICE_RESTRICTIONS", "NEEDS_DATA",
                    "Applicable security-specific price restrictions "
                            + "have not been supplied."
            ));
        } else {
            boolean passes =
                    price.compareTo(lowerPriceLimit) >= 0 &&
                    price.compareTo(upperPriceLimit) <= 0;

            checks.add(new RuleCheck(
                    "PRICE_RESTRICTIONS",
                    passes ? "PASS" : "FAIL",
                    "Order price " + price
                            + "; supplied permitted range "
                            + lowerPriceLimit + " to "
                            + upperPriceLimit + "."
            ));
        }

        long increment = quantityIncrement == null ? 1 : quantityIncrement;

        checks.add(new RuleCheck(
                "QUANTITY_INCREMENT",
                quantity % increment == 0 ? "PASS" : "FAIL",
                "Quantity must be a multiple of " + increment
                        + " for this simulated instrument."
        ));

        boolean failed = checks.stream()
                .anyMatch(c -> "FAIL".equals(c.status()));

        boolean missing = checks.stream()
                .anyMatch(c -> "NEEDS_DATA".equals(c.status()));

        String overall = failed ? "FAIL" :
                missing ? "NEEDS_DATA" : "PASS";

        return new Evaluation(
                market,
                currency,
                side,
                overall,
                List.copyOf(checks),
                "Educational simulation only. These checks do not "
                        + "verify live exchange rules, trading halts, "
                        + "broker restrictions, or actual order eligibility."
        );
    }
}