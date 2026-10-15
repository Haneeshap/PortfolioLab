package com.portfoliolab.backend.market;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/price-alerts")
public class PriceAlertController {
    private final PriceAlertService service;
    public PriceAlertController(PriceAlertService service) { this.service = service; }
    @GetMapping public List<PriceAlertService.Alert> list(@PathVariable long portfolioId) {
        try { return service.list(portfolioId); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage()); }
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public PriceAlertService.Alert create(@PathVariable long portfolioId, @RequestBody PriceAlertService.CreateAlert request) {
        try { return service.create(portfolioId, request); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage()); }
    }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable long portfolioId, @PathVariable long id) {
        try {
            if (!service.cancel(portfolioId, id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Active alert not found");
        } catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage()); }
    }
}
