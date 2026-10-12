
package com.portfoliolab.backend.portfolio;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}")
public class PortfolioQueryController {

    private final PortfolioQueryService portfolioQueryService;

    public PortfolioQueryController(
            PortfolioQueryService portfolioQueryService
    ) {
        this.portfolioQueryService = portfolioQueryService;
    }

    @GetMapping("/holdings")
    public List<HoldingResponse> getHoldings(
            @PathVariable Long portfolioId
    ) {
        return portfolioQueryService.getHoldings(portfolioId);
    }

    @GetMapping("/transactions")
    public List<TransactionResponse> getTransactions(
            @PathVariable Long portfolioId
    ) {
        return portfolioQueryService.getTransactions(portfolioId);
    }
}
