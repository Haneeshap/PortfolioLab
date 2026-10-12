package com.portfoliolab.backend.history;

import com.portfoliolab.backend.portfolio.PortfolioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/portfolios")
public class PortfolioHistoryController {
    private final JdbcTemplate jdbc;
    private final PortfolioRepository portfolios;

    public PortfolioHistoryController(
            JdbcTemplate jdbc,
            PortfolioRepository portfolios
    ) {
        this.jdbc = jdbc;
        this.portfolios = portfolios;
    }

    @GetMapping("/{id}/history")
    public List<Map<String, Object>> history(@PathVariable Long id) {
        if (!portfolios.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Portfolio not found"
            );
        }

        return jdbc.queryForList("""
                SELECT captured_at AS "capturedAt",
                       total_value AS "totalValue",
                       cash_balance AS "cashBalance",
                       holdings_value AS "holdingsValue",
                       currency,
                       valuation_source AS "valuationSource"
                FROM (
                    SELECT id, captured_at, total_value,
                           cash_balance, holdings_value,
                           currency, valuation_source
                    FROM portfolio_snapshots
                    WHERE portfolio_id = ?
                    ORDER BY captured_at DESC, id DESC
                    LIMIT 240
                ) recent
                ORDER BY captured_at ASC, id ASC
                """, id);
    }
}
