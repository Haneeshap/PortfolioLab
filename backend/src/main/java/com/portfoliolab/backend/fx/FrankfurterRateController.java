package com.portfoliolab.backend.fx;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/fx/reference")
public class FrankfurterRateController {

    private final FrankfurterRateService service;

    public FrankfurterRateController(
            FrankfurterRateService service
    ) {
        this.service = service;
    }

    @GetMapping
    public FrankfurterRateService.ExchangeRate getRate(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate date
    ) {
        if (date == null) {
            return service.getLatestRate(from, to);
        }

        return service.getHistoricalRate(from, to, date);
    }
}