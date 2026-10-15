package com.portfoliolab.backend.oms;

import com.portfoliolab.backend.portfolio.OrderRequest;
import com.portfoliolab.backend.portfolio.OrderResponse;
import com.portfoliolab.backend.portfolio.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Local exchange execution simulator. Uses the existing settlement service atomically.
 * Phase 3 can replace the local adapter with an independent Go exchange service.
 */
@Component
public class SimulatedExchangeWorker {
    private static final Logger log = LoggerFactory.getLogger(SimulatedExchangeWorker.class);
    private final JdbcTemplate jdbc;
    private final OrderService settlement;
    private final TransactionTemplate tx;

    public SimulatedExchangeWorker(JdbcTemplate jdbc, OrderService settlement, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        this.settlement = settlement;
        this.tx = new TransactionTemplate(manager);
    }

    record Pending(long id, long portfolioId, long assetId, String side,
                   BigDecimal requested, BigDecimal filled, String status) {}

    @Scheduled(fixedDelay = 2500, initialDelay = 5000)
    public void executeNext() {
        final long[] attemptedId = {-1};
        // Each cycle processes at most one order. Lock prevents concurrent fills/cancellation.
        try {
            tx.executeWithoutResult(ignored -> {
                List<Pending> pending = jdbc.query("""
                    SELECT id, portfolio_id, asset_id, side, requested_quantity,
                           filled_quantity, status
                    FROM simulated_orders
                    WHERE status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED')
                    ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED
                    """, (rs, row) -> new Pending(
                        rs.getLong("id"), rs.getLong("portfolio_id"), rs.getLong("asset_id"),
                        rs.getString("side"), rs.getBigDecimal("requested_quantity"),
                        rs.getBigDecimal("filled_quantity"), rs.getString("status")));
                if (pending.isEmpty()) return;
                Pending order = pending.get(0);
                attemptedId[0] = order.id();
                if (order.status().equals("SUBMITTED")) {
                    jdbc.update("UPDATE simulated_orders SET status='ACCEPTED',updated_at=NOW() WHERE id=?", order.id());
                    return;
                }
                BigDecimal remaining = order.requested().subtract(order.filled());
                if (remaining.signum() <= 0) throw new IllegalStateException("Invalid pending order remaining quantity");
                // Integer share quantities: fill half (rounded up), then remainder next cycle.
                BigDecimal fillQty = remaining.compareTo(BigDecimal.ONE) <= 0
                    ? remaining : remaining.divide(new BigDecimal("2"), 0, java.math.RoundingMode.CEILING);
                // Settlement enforces risk, buying power, holdings, pricing, FX, notifications.
                // Its @Transactional method joins this transaction; rollback is all-or-nothing.
                OrderResponse trade = settlement.placeOrder(order.portfolioId(),
                    new OrderRequest(order.assetId(), order.side(), fillQty));
                int sequence = jdbc.queryForObject("""
                    SELECT COALESCE(MAX(fill_sequence),0)+1
                    FROM simulated_exchange_executions WHERE order_id=?
                    """, Integer.class, order.id());
                String reference = "LOCAL-" + UUID.randomUUID();
                jdbc.update("""
                    INSERT INTO simulated_exchange_executions
                    (order_id,execution_ref,fill_sequence,transaction_id,quantity,price_per_unit)
                    VALUES (?,?,?,?,?,?)
                    """, order.id(), reference, sequence, trade.transactionId(), fillQty, trade.pricePerUnit());
                jdbc.update("""
                    INSERT INTO simulated_order_fills(order_id,transaction_id,fill_sequence,quantity)
                    VALUES (?,?,?,?)
                    """, order.id(), trade.transactionId(), sequence, fillQty);
                BigDecimal cumulative = order.filled().add(fillQty);
                String status = cumulative.compareTo(order.requested()) == 0 ? "FILLED" : "PARTIALLY_FILLED";
                jdbc.update("""
                    UPDATE simulated_orders SET filled_quantity=?,status=?,updated_at=NOW() WHERE id=?
                    """, cumulative, status, order.id());
                log.info("Simulated order {}: {} {} shares; {}", order.id(), reference, fillQty, status);
            });
        } catch (ResponseStatusException ex) {
            if (ex.getStatusCode().is5xxServerError()) {
                log.warn("Simulated execution temporarily unavailable; will retry: {}", ex.getReason());
                return;
            }
            // A permanent validation/risk failure rejects the order; no settlement was committed.
            String reason = ex.getReason() == null ? "Order rejected by settlement" : ex.getReason();
            try {
                if (attemptedId[0] < 0) return;
                tx.executeWithoutResult(ignored -> jdbc.update("""
                    UPDATE simulated_orders
SET status=CASE WHEN filled_quantity>0 THEN 'CANCELLED' ELSE 'REJECTED' END,
    failure_reason=?,
    updated_at=NOW()
                    WHERE id=? AND status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED')
                    """, reason, attemptedId[0]));
            } catch (Exception failure) { log.warn("Unable to persist rejection", failure); }
            log.warn("Simulated execution rejected: {}", reason);
        } catch (Exception ex) {
            // Transient market/FX or infrastructure failures must not silently reject orders.
            log.warn("Simulated exchange cycle rolled back; will retry: {}", ex.toString());
        }
    }
}
