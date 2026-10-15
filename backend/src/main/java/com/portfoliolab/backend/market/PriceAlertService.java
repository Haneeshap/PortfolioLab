package com.portfoliolab.backend.market;

import com.portfoliolab.backend.notification.PortfolioEventOutbox;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class PriceAlertService {
    private final JdbcTemplate jdbc;
    private final MarketService market;
    private final PortfolioEventOutbox outbox;
    private final org.springframework.transaction.support.TransactionTemplate tx;
    public PriceAlertService(JdbcTemplate jdbc, MarketService market, PortfolioEventOutbox outbox, org.springframework.transaction.PlatformTransactionManager manager) {
        this.jdbc = jdbc; this.market = market; this.outbox = outbox; this.tx = new org.springframework.transaction.support.TransactionTemplate(manager);
    }

    public record CreateAlert(String symbol, String direction, BigDecimal targetPrice) {}
    public record Alert(long id, long portfolioId, String symbol, String currency,
                        String direction, BigDecimal targetPrice, BigDecimal lastPrice,
                        String status, java.time.OffsetDateTime createdAt,
                        java.time.OffsetDateTime triggeredAt) {}
    private final org.springframework.jdbc.core.RowMapper<Alert> mapper = (rs, row) -> new Alert(
        rs.getLong("id"), rs.getLong("portfolio_id"), rs.getString("symbol"),
        rs.getString("currency"), rs.getString("direction"), rs.getBigDecimal("target_price"),
        rs.getBigDecimal("last_price"), rs.getString("status"),
        rs.getObject("created_at", java.time.OffsetDateTime.class),
        rs.getObject("triggered_at", java.time.OffsetDateTime.class));

    public List<Alert> list(long portfolioId) {
        requirePortfolio(portfolioId);
        return jdbc.query("SELECT * FROM market_price_alerts WHERE portfolio_id = ? ORDER BY created_at DESC, id DESC LIMIT 200", mapper, portfolioId);
    }

    public Alert create(long portfolioId, CreateAlert request) {
        requirePortfolio(portfolioId);
        if (request == null || request.symbol() == null || request.direction() == null || request.targetPrice() == null)
            throw new IllegalArgumentException("Symbol, direction and target price are required");
        String symbol = request.symbol().trim().toUpperCase(Locale.ROOT);
        String direction = request.direction().trim().toUpperCase(Locale.ROOT);
        if (!symbol.matches("[A-Z0-9._-]{1,20}") || !(direction.equals("ABOVE") || direction.equals("BELOW")))
            throw new IllegalArgumentException("Invalid symbol or direction");
        if (request.targetPrice().signum() <= 0 || request.targetPrice().scale() > 4 || request.targetPrice().precision() > 19)
            throw new IllegalArgumentException("Target price must be positive with at most 4 decimal places");
        MarketPrice quote = market.getCurrentPrices().stream().filter(p -> symbol.equals(p.symbol())).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Symbol not found in the live simulator"));
        if (quote.price() == null || quote.price().signum() <= 0)
            throw new IllegalArgumentException("Invalid current market price");
        BigDecimal current = quote.price().setScale(4, RoundingMode.HALF_UP);
        // A crossing requires starting on the opposite side of the target.
        if (direction.equals("ABOVE") && current.compareTo(request.targetPrice()) >= 0 ||
            direction.equals("BELOW") && current.compareTo(request.targetPrice()) <= 0)
            throw new IllegalArgumentException("Set a target above the current price for ABOVE, or below it for BELOW");
        Long id = jdbc.queryForObject("""
            INSERT INTO market_price_alerts(portfolio_id,symbol,currency,direction,target_price,last_price)
            VALUES(?,?,?,?,?,?) RETURNING id
            """, Long.class, portfolioId, symbol, quote.currency(), direction, request.targetPrice(), current);
        return jdbc.queryForObject("SELECT * FROM market_price_alerts WHERE id = ?", mapper, id);
    }

    public boolean cancel(long portfolioId, long id) {
        requirePortfolio(portfolioId);
        return jdbc.update("UPDATE market_price_alerts SET status='CANCELLED' WHERE id=? AND portfolio_id=? AND status='ACTIVE'", id, portfolioId) > 0;
    }

    private void requirePortfolio(long id) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM portfolios WHERE id=?", Integer.class, id);
        if (count == null || count == 0) throw new IllegalArgumentException("Portfolio not found");
    }

    @Scheduled(fixedDelay = 5000, initialDelay = 5000)
    public void poll() {
        Integer active = jdbc.queryForObject("SELECT count(*) FROM market_price_alerts WHERE status='ACTIVE'", Integer.class);
        if (active == null || active == 0) return;
        List<MarketPrice> quotes;
        try { quotes = market.getCurrentPrices(); }
        catch (Exception e) { return; } // Simulator may be temporarily offline.
        for (MarketPrice quote : quotes) {
            if (quote.price() == null || quote.price().signum() <= 0) continue;
            try { tx.executeWithoutResult(status -> evaluate(quote)); }
            catch (Exception e) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("Price alert evaluation failed for {}", quote.symbol(), e);
            }
        }
    }

    public void evaluate(MarketPrice quote) {
        BigDecimal current = quote.price().setScale(4, RoundingMode.HALF_UP);
        List<Alert> alerts = jdbc.query("""
            SELECT * FROM market_price_alerts
            WHERE status='ACTIVE' AND symbol=? AND currency=?
            ORDER BY id FOR UPDATE SKIP LOCKED
            """, mapper, quote.symbol(), quote.currency());
        for (Alert alert : alerts) {
            boolean crossed = alert.direction().equals("ABOVE")
                ? alert.lastPrice().compareTo(alert.targetPrice()) < 0 && current.compareTo(alert.targetPrice()) >= 0
                : alert.lastPrice().compareTo(alert.targetPrice()) > 0 && current.compareTo(alert.targetPrice()) <= 0;
            if (crossed) {
                jdbc.update("UPDATE market_price_alerts SET status='TRIGGERED', last_price=?, triggered_at=NOW() WHERE id=?", current, alert.id());
                outbox.record(alert.portfolioId(), "PRICE_ALERT", Map.of(
                    "title", "Simulated price alert: " + alert.symbol(),
                    "message", alert.symbol() + " crossed " + alert.direction().toLowerCase(Locale.ROOT) + " " +
                        alert.targetPrice() + " " + alert.currency() + "; observed price " + current + " " + alert.currency() + ".",
                    "targetUrl", "/alerts"));
            } else {
                jdbc.update("UPDATE market_price_alerts SET last_price=? WHERE id=?", current, alert.id());
            }
        }
    }
}
