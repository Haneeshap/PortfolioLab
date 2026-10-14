package com.portfoliolab.backend.risk;

import com.portfoliolab.backend.notification.PortfolioEventOutbox;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

@Service
public class PortfolioRiskAgent {
    private final JdbcTemplate jdbc;
    private final PortfolioEventOutbox outbox;
    public PortfolioRiskAgent(JdbcTemplate jdbc, PortfolioEventOutbox outbox) {
        this.jdbc = jdbc;
        this.outbox = outbox;
    }
    @Transactional
    public Map<String, Object> analyze(long portfolioId) {
        Integer exists = jdbc.queryForObject("SELECT count(*) FROM portfolios WHERE id = ?", Integer.class, portfolioId);
        if (exists == null || exists == 0) throw new IllegalArgumentException("Portfolio not found");
        // Historical cost is already denominated in portfolio currency, unlike raw market prices.
        var positions = jdbc.query("""
                SELECT a.symbol, h.historical_cost_portfolio AS value
                FROM holdings h JOIN assets a ON a.id = h.asset_id
                WHERE h.portfolio_id = ? AND h.historical_cost_portfolio > 0
                ORDER BY h.historical_cost_portfolio DESC, a.symbol
                """, (rs, row) -> Map.<String,Object>of(
                    "symbol", rs.getString("symbol"), "value", rs.getBigDecimal("value")), portfolioId);
        if (positions.isEmpty()) return Map.of("status", "NO_HOLDINGS", "notificationCreated", false);
        BigDecimal total = positions.stream().map(p -> (BigDecimal)p.get("value"))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.signum() <= 0) return Map.of("status", "NO_COST_BASIS", "notificationCreated", false);
        var top = positions.get(0);
        String symbol = (String)top.get("symbol");
        BigDecimal percentage = ((BigDecimal)top.get("value"))
                .multiply(BigDecimal.valueOf(100)).divide(total, 1, RoundingMode.HALF_UP);
        if (percentage.compareTo(BigDecimal.valueOf(50)) < 0)
            return Map.of("status", "BELOW_THRESHOLD", "largestPosition", symbol,
                    "concentrationPercent", percentage, "notificationCreated", false);
        String band = percentage.compareTo(BigDecimal.valueOf(75)) >= 0 ? "HIGH" : "ELEVATED";
        String key = "COST_CONCENTRATION:" + symbol + ":" + band;
        // Once per day per symbol and severity; atomic suppression for concurrent requests.
        int emitted = jdbc.update("""
                INSERT INTO portfolio_risk_insights (portfolio_id, insight_key, last_emitted_at)
                VALUES (?, ?, NOW())
                ON CONFLICT (portfolio_id, insight_key) DO UPDATE
                  SET last_emitted_at = NOW()
                  WHERE portfolio_risk_insights.last_emitted_at < NOW() - INTERVAL '1 day'
                """, portfolioId, key);
        if (emitted > 0) {
            outbox.record(portfolioId, "AGENT_INSIGHT", Map.of(
                    "title", "Portfolio concentration insight",
                    "message", symbol + " represents " + percentage + "% of your invested historical cost. Consider reviewing diversification. This is a simulation, not investment advice.",
                    "targetUrl", "/portfolio"));
        }
        return Map.of("status", band, "largestPosition", symbol,
                "concentrationPercent", percentage, "notificationCreated", emitted > 0);
    }
}