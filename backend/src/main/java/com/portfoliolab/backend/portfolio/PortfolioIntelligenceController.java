package com.portfoliolab.backend.portfolio;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/portfolios/{id}")
public class PortfolioIntelligenceController {
    private final PortfolioIntelligenceService service;
    public PortfolioIntelligenceController(PortfolioIntelligenceService service){this.service=service;}
    @GetMapping("/performance")
    public PortfolioIntelligenceService.Performance performance(@PathVariable long id,@RequestParam(defaultValue="1M") String period){return service.performance(id,period);}
    @PostMapping("/rebalance/preview")
    public PortfolioIntelligenceService.Plan preview(@PathVariable long id,@RequestBody PortfolioIntelligenceService.Targets targets){return service.plan(id,targets);}
}
