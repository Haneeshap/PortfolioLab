package com.portfoliolab.backend.bonus;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bonus")
public class BonusController {

    private final BonusSimulationService service;

    public BonusController(BonusSimulationService service) {
        this.service = service;
    }

    @PostMapping("/simulate")
    public BonusSimulationResponse simulate(
            @RequestBody BonusSimulationRequest request) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "A simulation request is required");
        }

        BonusSimulationService.BonusResult result =
                service.simulate(
                        request.existingShares(),
                        request.bonusShares(),
                        request.requiredShares()
                );

        String calculation =
                result.existingShares()
                + " existing shares at a "
                + result.bonusShares()
                + ":"
                + result.requiredShares()
                + " bonus ratio = "
                + result.additionalShares()
                + " additional shares; "
                + result.totalShares()
                + " total shares";

        return new BonusSimulationResponse(
                result.existingShares(),
                result.bonusShares(),
                result.requiredShares(),
                result.additionalShares(),
                result.totalShares(),
                calculation,
                "Educational simulation only. Actual eligibility, "
                        + "corporate action terms, and fractional-share "
                        + "treatment are not determined."
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleInvalidInput(
            IllegalArgumentException exception) {

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", exception.getMessage()));
    }
}