package com.portfoliolab.backend.research;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/portfolios/{portfolioId}/risk-lab")
public class RiskLabController {
 private final RiskLabService risk;public RiskLabController(RiskLabService risk){this.risk=risk;}
 @GetMapping public RiskLabService.Result exposure(@PathVariable long portfolioId){return risk.evaluate(portfolioId,null);}
 @PostMapping("/scenario") public RiskLabService.Result scenario(@PathVariable long portfolioId,@RequestBody RiskLabService.Scenario input){return risk.evaluate(portfolioId,input);}
}
