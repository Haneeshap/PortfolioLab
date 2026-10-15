package com.portfoliolab.backend.risk;

import com.portfoliolab.backend.asset.Asset;
import com.portfoliolab.backend.portfolio.Portfolio;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/** Authoritative simulated policy evaluation. Call under the portfolio write lock. */
@Service
public class PreTradeRiskService {
    private final JdbcTemplate jdbc;
    public PreTradeRiskService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Check(String code, String status, String explanation) {}
    public record Decision(String decision, List<Check> checks, String disclaimer) {}
    private record Policy(BigDecimal maxOrderValue, BigDecimal maxPositionPct, boolean enabled) {}

    public Decision evaluate(Portfolio portfolio, Asset asset, String side,
                             BigDecimal quantity, BigDecimal portfolioAmount) {
        if (!"BUY".equals(side) && !"SELL".equals(side))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported order side");
        if (quantity == null || quantity.signum() <= 0 || portfolioAmount == null || portfolioAmount.signum() <= 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid order amount");
        // Portfolio and asset are loaded by the server, not supplied as trusted client values.
        List<Policy> configured = jdbc.query("SELECT max_order_value, max_position_pct, enabled FROM pre_trade_risk_policies WHERE portfolio_id=?",
            (rs, i) -> new Policy(rs.getBigDecimal(1), rs.getBigDecimal(2), rs.getBoolean(3)), portfolio.getId());
        Policy policy = configured.isEmpty() ? new Policy(new BigDecimal("50000"), new BigDecimal("100"), true) : configured.get(0);
        List<Check> checks = new ArrayList<>();
        if (!policy.enabled()) {
            checks.add(new Check("POLICY_ENABLED", "SKIPPED", "Portfolio risk policy disabled by configuration"));
            return new Decision("ALLOW", List.copyOf(checks), "Educational simulated order evaluation only.");
        }
        boolean orderLimit = portfolioAmount.compareTo(policy.maxOrderValue()) <= 0;
        checks.add(new Check("MAX_ORDER_VALUE", orderLimit ? "PASS" : "FAIL",
            "Order value " + portfolioAmount + " " + portfolio.getCurrency() + "; maximum " + policy.maxOrderValue()));
        if ("BUY".equals(side)) {
            // Cost basis is stored in portfolio currency; do not sum raw multi-currency prices.
            BigDecimal totalInvested = jdbc.queryForObject(
                "SELECT COALESCE(SUM(historical_cost_portfolio),0) FROM holdings WHERE portfolio_id=?",
                BigDecimal.class, portfolio.getId());
            BigDecimal currentPosition = jdbc.queryForObject(
                "SELECT COALESCE(SUM(historical_cost_portfolio),0) FROM holdings WHERE portfolio_id=? AND asset_id=?",
                BigDecimal.class, portfolio.getId(), asset.getId());
            BigDecimal afterInvested = totalInvested.add(portfolioAmount);
            BigDecimal afterPosition = currentPosition.add(portfolioAmount);
            // The policy is a concentration-of-invested-cost limit, not an equity-market-value limit.
            BigDecimal pct = afterPosition.multiply(new BigDecimal("100"))
                .divide(afterInvested, 4, RoundingMode.HALF_UP);
            boolean concentrationPass = pct.compareTo(policy.maxPositionPct()) <= 0;
            checks.add(new Check("MAX_POSITION_COST_CONCENTRATION", concentrationPass ? "PASS" : "FAIL",
                "Post-trade position cost share " + pct + "%; maximum " + policy.maxPositionPct() + "%"));
        }
        boolean rejected = checks.stream().anyMatch(c -> "FAIL".equals(c.status()));
        return new Decision(rejected ? "BLOCK" : "ALLOW", List.copyOf(checks),
            "Educational simulation. Position concentration is measured using historical invested cost, not live market value.");
    }

    public void enforce(Portfolio portfolio, Asset asset, String side,
                        BigDecimal quantity, BigDecimal portfolioAmount) {
        Decision decision = evaluate(portfolio, asset, side, quantity, portfolioAmount);
        if ("BLOCK".equals(decision.decision())) {
            String codes = decision.checks().stream().filter(c -> "FAIL".equals(c.status()))
                .map(Check::code).reduce((a,b) -> a + ", " + b).orElse("UNKNOWN");
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Pre-trade risk rejected order: " + codes);
        }
    }
}
