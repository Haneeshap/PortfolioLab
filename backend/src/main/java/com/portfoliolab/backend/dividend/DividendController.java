
package com.portfoliolab.backend.dividend;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dividends")
public class DividendController {

    private static final Set<String> SUPPORTED_CURRENCIES =
            Set.of("INR", "USD", "EUR");

    private final DividendSimulationService service;

    public DividendController(DividendSimulationService service) {
        this.service = service;
    }

    @PostMapping("/simulate")
    public DividendSimulationResponse simulate(
            @RequestBody DividendSimulationRequest request) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "A simulation request is required"
            );
        }

        String currency = request.currency() == null
                ? ""
                : request.currency().trim().toUpperCase(Locale.ROOT);

        if (!SUPPORTED_CURRENCIES.contains(currency)) {
            throw new IllegalArgumentException(
                    "Currency must be INR, USD, or EUR"
            );
        }

        BigDecimal grossDividend = service.calculateGrossDividend(
                request.eligibleShares(),
                request.dividendPerShare()
        );

        String calculation = request.eligibleShares()
                + " shares × "
                + request.dividendPerShare()
                + " "
                + currency
                + " per share = "
                + grossDividend
                + " "
                + currency;

        return new DividendSimulationResponse(
                request.eligibleShares(),
                request.dividendPerShare(),
                grossDividend,
                currency,
                calculation,
                "Educational simulation only. Record-date eligibility, "
                        + "taxes, and actual dividend payments are not determined."
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleInvalidInput(
            IllegalArgumentException exception) {

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", exception.getMessage()));
    }
}
