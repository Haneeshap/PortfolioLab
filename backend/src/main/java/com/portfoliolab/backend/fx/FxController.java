package com.portfoliolab.backend.fx;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/fx")
public class FxController {

    private final FxConversionService service;

    public FxController(FxConversionService service) {
        this.service = service;
    }

    @GetMapping("/convert")
    public FxConversionResponse convert(
        @RequestParam String from,
        @RequestParam String to,
        @RequestParam BigDecimal amount
    ) {
        return service.convert(from, to, amount);
    }
}