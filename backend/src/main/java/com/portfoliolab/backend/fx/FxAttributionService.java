package com.portfoliolab.backend.fx;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class FxAttributionService {

    private static final int SCALE = 4;

    public AttributionResult calculate(
        BigDecimal quantity,
        BigDecimal purchasePrice,
        BigDecimal currentPrice,
        BigDecimal purchaseFxRate,
        BigDecimal currentFxRate
    ) {
        validate(quantity);
        validate(purchasePrice);
        validate(currentPrice);
        validate(purchaseFxRate);
        validate(currentFxRate);

        BigDecimal originalValue = quantity
            .multiply(purchasePrice)
            .multiply(purchaseFxRate);

        BigDecimal currentValue = quantity
            .multiply(currentPrice)
            .multiply(currentFxRate);

        BigDecimal assetImpact = quantity
            .multiply(currentPrice.subtract(purchasePrice))
            .multiply(purchaseFxRate);

        BigDecimal fxImpact = quantity
            .multiply(currentPrice)
            .multiply(currentFxRate.subtract(purchaseFxRate));

        BigDecimal netChange = currentValue.subtract(originalValue);

        BigDecimal returnPercent = netChange
            .multiply(BigDecimal.valueOf(100))
            .divide(originalValue, SCALE, RoundingMode.HALF_UP);

        return new AttributionResult(
            money(originalValue),
            money(currentValue),
            money(assetImpact),
            money(fxImpact),
            money(netChange),
            returnPercent
        );
    }

    private void validate(BigDecimal value) {
        if (value == null ||
            value.signum() <= 0 ||
            value.precision() > 19 ||
            value.scale() > 8) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Inputs must be positive numbers with supported precision"
            );
        }
    }

    private BigDecimal money(BigDecimal value) {
        BigDecimal rounded = value.setScale(
            SCALE, RoundingMode.HALF_UP
        );

        if (rounded.precision() > 19) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Calculated value exceeds supported precision"
            );
        }

        return rounded;
    }

    public record AttributionResult(
        BigDecimal originalValue,
        BigDecimal currentValue,
        BigDecimal assetImpact,
        BigDecimal fxImpact,
        BigDecimal netChange,
        BigDecimal returnPercent
    ) {}
}