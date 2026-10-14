package com.portfoliolab.backend.dividend;

import com.portfoliolab.backend.notification.PortfolioEventOutbox;
import com.portfoliolab.backend.portfolio.PortfolioRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ScheduledDividendService {
    private final JdbcTemplate jdbc;
    private final PortfolioRepository portfolios;
    private final PortfolioEventOutbox outbox;

    public ScheduledDividendService(JdbcTemplate jdbc, PortfolioRepository portfolios, PortfolioEventOutbox outbox) {
        this.jdbc = jdbc;
        this.portfolios = portfolios;
        this.outbox = outbox;
    }

    @Transactional
    public Map<String, Object> create(Long assetId, String referenceKey, BigDecimal dividendPerShare,
                                      String currency, Instant recordCutoff, Instant paymentAt) {
        if (assetId == null || assetId <= 0 || referenceKey == null ||
            !referenceKey.matches("[A-Za-z0-9._:-]{1,120}") ||
            dividendPerShare == null || dividendPerShare.signum() <= 0 ||
            dividendPerShare.scale() > 4 || dividendPerShare.precision() > 19 ||
            currency == null || recordCutoff == null || paymentAt == null ||
            !paymentAt.isAfter(recordCutoff)) {
            throw new IllegalArgumentException("Invalid schedule: paymentAt must be after recordCutoff");
        }
        String normalizedCurrency = currency.trim().toUpperCase(Locale.ROOT);
        if (!List.of("INR", "USD", "EUR").contains(normalizedCurrency)) {
            throw new IllegalArgumentException("Unsupported currency");
        }
        List<String> assetCurrencies = jdbc.query("SELECT currency FROM assets WHERE id = ?",
            (rs, n) -> rs.getString(1), assetId);
        if (assetCurrencies.isEmpty() || !normalizedCurrency.equalsIgnoreCase(assetCurrencies.get(0))) {
            throw new IllegalArgumentException("Asset not found or asset currency does not match schedule");
        }
        Long id;
        try {
            id = jdbc.queryForObject("""
                INSERT INTO simulated_dividend_schedules
                    (asset_id, reference_key, dividend_per_share, currency, record_cutoff, payment_at)
                VALUES (?, ?, ?, ?, ?, ?) RETURNING id
                """, Long.class, assetId, referenceKey, dividendPerShare, normalizedCurrency,
                Timestamp.from(recordCutoff), Timestamp.from(paymentAt));
        } catch (org.springframework.dao.DuplicateKeyException e) {
            throw new IllegalArgumentException("Schedule referenceKey already exists");
        }
        return Map.of("id", id, "referenceKey", referenceKey, "status", "SCHEDULED");
    }

    public List<Map<String, Object>> list() {
        return jdbc.queryForList("""
            SELECT id, asset_id, reference_key, dividend_per_share, currency,
                   record_cutoff, payment_at, created_at
            FROM simulated_dividend_schedules ORDER BY id DESC LIMIT 100
            """);
    }

    public List<Long> dueScheduleIds() {
        return jdbc.queryForList("""
            SELECT id FROM simulated_dividend_schedules
            WHERE payment_at <= NOW() ORDER BY id LIMIT 100
            """, Long.class);
    }

    public List<Long> candidatePortfolioIds(long scheduleId) {
        // Include anyone who traded the asset by the record cutoff, even if they sold later.
        return jdbc.queryForList("""
            SELECT DISTINCT t.portfolio_id
            FROM transactions t JOIN simulated_dividend_schedules s ON s.asset_id = t.asset_id
            WHERE s.id = ? AND t.created_at <= s.record_cutoff
            ORDER BY t.portfolio_id
            """, Long.class, scheduleId);
    }

    @Transactional
    public String creditIfEligible(long scheduleId, long portfolioId) {
        // Serializes cash changes and duplicate scheduler attempts for this portfolio.
        var portfolio = portfolios.findByIdForUpdate(portfolioId).orElse(null);
        if (portfolio == null) return "MISSING_PORTFOLIO";
        var schedules = jdbc.query("""
            SELECT s.asset_id, s.reference_key, s.dividend_per_share, s.currency, s.record_cutoff, a.symbol
            FROM simulated_dividend_schedules s JOIN assets a ON a.id = s.asset_id
            WHERE s.id = ? AND s.payment_at <= NOW()
            """, (rs, n) -> new ScheduleRow(rs.getLong("asset_id"), rs.getString("reference_key"),
            rs.getBigDecimal("dividend_per_share"), rs.getString("currency"),
            rs.getTimestamp("record_cutoff").toInstant(), rs.getString("symbol")), scheduleId);
        if (schedules.isEmpty()) return "NOT_DUE";
        var s = schedules.get(0);
        if (!s.currency().equalsIgnoreCase(portfolio.getCurrency())) return "CURRENCY_MISMATCH";
        Integer already = jdbc.queryForObject("""
            SELECT count(*) FROM simulated_scheduled_dividend_payments
            WHERE schedule_id = ? AND portfolio_id = ?
            """, Integer.class, scheduleId, portfolioId);
        if (already != null && already > 0) return "ALREADY_CREDITED";
        BigDecimal eligible = jdbc.queryForObject("""
            SELECT COALESCE(SUM(CASE WHEN transaction_type = 'BUY' THEN quantity
                               WHEN transaction_type = 'SELL' THEN -quantity
                               ELSE 0 END), 0)
            FROM transactions
            WHERE portfolio_id = ? AND asset_id = ? AND created_at <= ?
            """, BigDecimal.class, portfolioId, s.assetId(), Timestamp.from(s.recordCutoff()));
        if (eligible == null || eligible.signum() <= 0) return "NOT_ELIGIBLE";
        eligible = eligible.setScale(0, RoundingMode.DOWN);
        if (eligible.signum() <= 0) return "NOT_ELIGIBLE";
        BigDecimal amount = eligible.multiply(s.perShare()).setScale(4, RoundingMode.HALF_UP);
        if (amount.signum() <= 0) return "ZERO_AMOUNT";
        jdbc.update("""
            INSERT INTO simulated_scheduled_dividend_payments
                (schedule_id, portfolio_id, eligible_shares, amount)
            VALUES (?, ?, ?, ?)
            """, scheduleId, portfolioId, eligible, amount);
        portfolio.setCashBalance(portfolio.getCashBalance().add(amount));
        portfolios.saveAndFlush(portfolio);
        outbox.record(portfolioId, "DIVIDEND_CREDITED", Map.of(
            "title", "Scheduled simulated dividend credited",
            "message", "A simulated scheduled dividend of " + amount + " " + s.currency() +
                " for " + s.symbol() + " was credited (" + eligible + " record-date shares).",
            "targetUrl", "/portfolio"));
        return "CREDITED";
    }

    private record ScheduleRow(long assetId, String referenceKey, BigDecimal perShare,
                               String currency, Instant recordCutoff, String symbol) {}
}
