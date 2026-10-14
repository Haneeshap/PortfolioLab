package com.portfoliolab.backend.risk;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/risk")
public class PortfolioRiskController {
    private final PortfolioRiskAgent agent;
    public PortfolioRiskController(PortfolioRiskAgent agent) { this.agent = agent; }
    @PostMapping("/analyze")
    public Map<String,Object> analyze(@PathVariable long portfolioId) {
        try { return agent.analyze(portfolioId); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage()); }
    }
}