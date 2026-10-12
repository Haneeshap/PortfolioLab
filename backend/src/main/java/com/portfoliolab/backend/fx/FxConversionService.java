package com.portfoliolab.backend.fx;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.Optional;

@Service
public class FxConversionService {

    private static final int RATE_SCALE = 12;
    private static final int AMOUNT_SCALE = 4;

    private final FxRateRepository repository;

    public FxConversionService(FxRateRepository repository) {
        this.repository = repository;
    }

    public FxConversionResponse convert(
        String from,
        String to,
        BigDecimal amount
    ) {
        String source = normalize(from);
        String target = normalize(to);

        if (amount == null ||
            amount.signum() <= 0 ||
            amount.precision() > 19 ||
            amount.scale() > 4) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Amount must be positive with at most 4 decimal places"
            );
        }

        if (source.equals(target)) {
            return response(
                source, target, amount,
                BigDecimal.ONE, "IDENTITY"
            );
        }

        Optional<FxRate> direct = lookup(source, target);

        if (direct.isPresent()) {
            return response(
                source, target, amount,
                direct.get().getRate(),
                direct.get().getSource()
            );
        }

        Optional<FxRate> reverse = lookup(target, source);

        if (reverse.isPresent()) {
            BigDecimal rate = BigDecimal.ONE.divide(
                reverse.get().getRate(),
                RATE_SCALE,
                RoundingMode.HALF_UP
            );

            return response(
                source, target, amount,
                rate, reverse.get().getSource()
            );
        }

        if (!source.equals("INR") && !target.equals("INR")) {
            Optional<FxRate> sourceToInr = lookup(source, "INR");
            Optional<FxRate> inrToSource = lookup("INR", source);
            Optional<FxRate> inrToTarget = lookup("INR", target);
            Optional<FxRate> targetToInr = lookup(target, "INR");

            BigDecimal firstLeg = sourceToInr
                .map(FxRate::getRate)
                .orElseGet(() -> inrToSource
                    .map(rate -> inverse(rate.getRate()))
                    .orElse(null));

            BigDecimal secondLeg = inrToTarget
                .map(FxRate::getRate)
                .orElseGet(() -> targetToInr
                    .map(rate -> inverse(rate.getRate()))
                    .orElse(null));

            if (firstLeg != null && secondLeg != null) {
                return response(
                    source, target, amount,
                    firstLeg.multiply(secondLeg),
                    "SIMULATED_CROSS"
                );
            }
        }

        throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "No simulated FX conversion path available"
        );
    }

    private Optional<FxRate> lookup(String from, String to) {
        return repository
            .findFirstByBaseCurrencyAndQuoteCurrencyOrderByCapturedAtDescIdDesc(
                from, to
            );
    }

    private BigDecimal inverse(BigDecimal rate) {
        return BigDecimal.ONE.divide(
            rate, RATE_SCALE, RoundingMode.HALF_UP
        );
    }

    private String normalize(String currency) {
        if (currency == null ||
            !currency.matches("[A-Za-z]{3}")) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Currency must be a three-letter code"
            );
        }

        return currency.toUpperCase(Locale.ROOT);
    }

    private FxConversionResponse response(
        String from,
        String to,
        BigDecimal amount,
        BigDecimal rate,
        String source
    ) {
        BigDecimal converted;

        try {
            converted = amount.multiply(rate)
                .setScale(AMOUNT_SCALE, RoundingMode.HALF_UP);

            if (converted.precision() > 19) {
                throw new ArithmeticException("Amount overflow");
            }
        } catch (ArithmeticException exception) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Converted amount exceeds supported precision"
            );
        }

        return new FxConversionResponse(
            from, to, amount, converted,
            rate.setScale(RATE_SCALE, RoundingMode.HALF_UP),
            source
        );
    }
}