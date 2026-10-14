package com.portfoliolab.backend.dividend;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dividends/schedules")
public class ScheduledDividendController {
    private final ScheduledDividendService service;
    public ScheduledDividendController(ScheduledDividendService service) { this.service = service; }

    public record CreateRequest(Long assetId, String referenceKey, BigDecimal dividendPerShare,
                                String currency, Instant recordCutoff, Instant paymentAt) {}

    @PostMapping
    public Map<String, Object> create(@RequestBody CreateRequest request) {
        if (request == null) throw new IllegalArgumentException("Request required");
        return service.create(request.assetId(), request.referenceKey(), request.dividendPerShare(),
            request.currency(), request.recordCutoff(), request.paymentAt());
    }

    @GetMapping
    public List<Map<String, Object>> list() { return service.list(); }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalid(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
    }
}
