package com.portfoliolab.backend.businessrules;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/business-rules")
public class MarketRulesController {

    private final MarketRulesService service;

    public MarketRulesController(MarketRulesService service) {
        this.service = service;
    }

    @PostMapping("/evaluate")
    public MarketRulesService.Evaluation evaluate(
            @RequestBody MarketRulesRequest request) {

        return service.evaluate(
                request.market(),
                request.side(),
                request.quantity(),
                request.price(),
                request.availableCash(),
                request.availableShares(),
                request.estimatedCharges(),
                request.lowerPriceLimit(),
                request.upperPriceLimit(),
                request.quantityIncrement()
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleInvalidInput(
            IllegalArgumentException exception) {

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", exception.getMessage()));
    }
}