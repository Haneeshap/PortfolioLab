package com.portfoliolab.backend.dividend;

import com.portfoliolab.backend.notification.PortfolioEventOutbox;
import com.portfoliolab.backend.portfolio.PortfolioRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

@Service
public class DividendCreditService {
    private final JdbcTemplate jdbc;
    private final PortfolioRepository portfolios;
    private final PortfolioEventOutbox outbox;
    public DividendCreditService(JdbcTemplate jdbc, PortfolioRepository portfolios, PortfolioEventOutbox outbox) {
        this.jdbc = jdbc; this.portfolios = portfolios; this.outbox = outbox;
    }
    @Transactional
    public Map<String,Object> credit(long portfolioId, DividendCreditRequest request) {
        if (request == null || request.assetId() == null || request.assetId() <= 0 ||
            request.referenceKey() == null || !request.referenceKey().matches("[A-Za-z0-9._:-]{1,120}") ||
            request.dividendPerShare() == null || request.dividendPerShare().signum() <= 0 ||
            request.currency() == null) throw new IllegalArgumentException("Invalid dividend request");
        if (request.dividendPerShare().scale() > 4 || request.dividendPerShare().precision() > 19)
            throw new IllegalArgumentException("Dividend per share must fit 4 decimal places");
        var portfolio = portfolios.findByIdForUpdate(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
        String currency = request.currency().trim().toUpperCase(java.util.Locale.ROOT);
        if (!currency.equals(portfolio.getCurrency()))
            throw new IllegalArgumentException("Dividend currency must match portfolio currency; FX conversion is not implemented");
        // The reference is scoped to the portfolio, so a retried request never credits twice.
        Integer existing = jdbc.queryForObject("""
                SELECT count(*) FROM simulated_dividend_payments WHERE portfolio_id = ? AND reference_key = ?
                """, Integer.class, portfolioId, request.referenceKey());
        if (existing != null && existing > 0)
            return Map.of("status", "ALREADY_CREDITED", "referenceKey", request.referenceKey());
        var shares = jdbc.query("""
                SELECT h.quantity, a.symbol, a.currency FROM holdings h
                JOIN assets a ON a.id = h.asset_id
                WHERE h.portfolio_id = ? AND h.asset_id = ?
                """, (rs, row) -> Map.<String,Object>of(
                    "quantity", rs.getBigDecimal("quantity"), "symbol", rs.getString("symbol"),
                    "currency", rs.getString("currency")), portfolioId, request.assetId());
        if (shares.isEmpty()) throw new IllegalArgumentException("No eligible holding for this asset");
        var holding = shares.get(0);
        if (!currency.equalsIgnoreCase((String)holding.get("currency")))
            throw new IllegalArgumentException("Asset currency must match portfolio currency in this version");
        BigDecimal eligible = ((BigDecimal)holding.get("quantity")).setScale(0, RoundingMode.DOWN);
        if (eligible.signum() <= 0) throw new IllegalArgumentException("No whole eligible shares");
        BigDecimal amount = eligible.multiply(request.dividendPerShare()).setScale(4, RoundingMode.HALF_UP);
        if (amount.signum() <= 0) throw new IllegalArgumentException("Dividend amount is zero");
        jdbc.update("""
                INSERT INTO simulated_dividend_payments
                (portfolio_id, asset_id, reference_key, eligible_shares, dividend_per_share, amount, currency)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, portfolioId, request.assetId(), request.referenceKey(), eligible,
                request.dividendPerShare(), amount, currency);
        portfolio.setCashBalance(portfolio.getCashBalance().add(amount));
        portfolios.save(portfolio);
        outbox.record(portfolioId, "DIVIDEND_CREDITED", Map.of(
                "title", "Simulated dividend credited",
                "message", "A simulated dividend of " + amount + " " + currency + " for " + holding.get("symbol") + " has been credited to your portfolio.",
                "targetUrl", "/portfolio"));
        return Map.of("status", "CREDITED", "amount", amount, "currency", currency,
                "eligibleShares", eligible, "referenceKey", request.referenceKey());
    }
}