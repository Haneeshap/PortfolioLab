
package com.portfoliolab.backend.market;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final MarketService marketService;

    public MarketController(MarketService marketService) {
        this.marketService = marketService;
    }

    @GetMapping("/prices")
    public List<MarketPrice> getPrices() {
        return marketService.getCurrentPrices();
    }

    @ExceptionHandler(MarketServiceUnavailableException.class)
    public ResponseEntity<Map<String, String>> handleUnavailable(
            MarketServiceUnavailableException exception
    ) {
        return ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "error", "Market simulator unavailable"
                ));
    }
}
