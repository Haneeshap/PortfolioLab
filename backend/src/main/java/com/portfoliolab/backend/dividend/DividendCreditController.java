package com.portfoliolab.backend.dividend;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/dividends")
public class DividendCreditController {
    private final DividendCreditService service;
    public DividendCreditController(DividendCreditService service) { this.service = service; }
    @PostMapping("/credit")
    public Map<String,Object> credit(@PathVariable long portfolioId, @RequestBody DividendCreditRequest request) {
        try { return service.credit(portfolioId, request); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage()); }
    }
}