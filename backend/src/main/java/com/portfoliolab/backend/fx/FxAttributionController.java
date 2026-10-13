package com.portfoliolab.backend.fx;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/fx")
public class FxAttributionController {

    private final FxAttributionService service;

    public FxAttributionController(FxAttributionService service) {
        this.service = service;
    }

    @PostMapping("/attribution")
    public FxAttributionService.AttributionResult calculate(
        @RequestBody FxAttributionRequest request
    ) {
        return service.calculate(
            request.quantity(),
            request.purchasePrice(),
            request.currentPrice(),
            request.purchaseFxRate(),
            request.currentFxRate()
        );
    }
}