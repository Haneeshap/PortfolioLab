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
    @org.springframework.beans.factory.annotation.Autowired private OrderReservations reservations;
    private final JdbcTemplate jdbc;
    private final OrderService settlement;
    private final TransactionTemplate tx;

    public SimulatedExchangeWorker(JdbcTemplate jdbc, OrderService settlement, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        this.settlement = settlement;
        this.tx = new TransactionTemplate(manager);
    }

    record Pending(long id, long portfolioId, long assetId, String side,
                   BigDecimal requested, BigDecimal filled, String status, BigDecimal limit, java.time.Instant expires) {}

    @Scheduled(fixedDelayString = "${oms.worker.delay:2500}", initialDelayString = "${oms.worker.initial-delay:5000}")
    public void executeNext() { executePortfolio(null); }

    void executePortfolio(Long portfolioId) {
        final long[] attemptedId = {-1};
        final long[] attemptedPortfolio = {-1};
        // Each cycle processes at most one order. Lock prevents concurrent fills/cancellation.
        try {
            tx.executeWithoutResult(ignored -> {
                List<Long> candidates=jdbc.queryForList("SELECT portfolio_id FROM simulated_orders WHERE status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED') "+(portfolioId==null?"":" AND portfolio_id="+portfolioId)+" ORDER BY updated_at,id LIMIT 1",Long.class);
                if(candidates.isEmpty()) return;
                reservations.lock(candidates.get(0));
                List<Pending> pending = jdbc.query("""
                    SELECT id, portfolio_id, asset_id, side, requested_quantity,
                           filled_quantity, status, limit_price, expires_at
                    FROM simulated_orders
                    WHERE status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED') AND portfolio_id=?
                    ORDER BY updated_at ASC,id ASC LIMIT 1 FOR UPDATE SKIP LOCKED
                    """, (rs, row) -> new Pending(
                        rs.getLong("id"), rs.getLong("portfolio_id"), rs.getLong("asset_id"),
                        rs.getString("side"), rs.getBigDecimal("requested_quantity"),
                        rs.getBigDecimal("filled_quantity"), rs.getString("status"),rs.getBigDecimal("limit_price"),rs.getTimestamp("expires_at")==null?null:rs.getTimestamp("expires_at").toInstant()),candidates.get(0));
                if (pending.isEmpty()) return;
                Pending order = pending.get(0);
                attemptedId[0] = order.id();
                attemptedPortfolio[0]=order.portfolioId();
                if (order.expires()!=null && !order.expires().isAfter(java.time.Instant.now())) {
                    reservations.release(order.id());
                    jdbc.update("UPDATE simulated_orders SET status='EXPIRED',updated_at=NOW() WHERE id=?",order.id());
                    return;
                }
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
                reservations.remaining(order.id(),remaining.subtract(fillQty));
                OrderResponse trade = settlement.placeOrder(order.portfolioId(),
                    new OrderRequest(order.assetId(), order.side(), fillQty,order.limit()==null?"MARKET":"LIMIT",order.limit(),"GTC"));
                if(order.expires()!=null && !order.expires().isAfter(java.time.Instant.now())) throw new ExpiredDuringFill();
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
                reservations.remaining(order.id(),order.requested().subtract(cumulative));
                String status = cumulative.compareTo(order.requested()) == 0 ? "FILLED" : "PARTIALLY_FILLED";
                jdbc.update("""
                    UPDATE simulated_orders SET filled_quantity=?,status=?,updated_at=NOW() WHERE id=?
                    """, cumulative, status, order.id());
                log.info("Simulated order {}: {} {} shares; {}", order.id(), reference, fillQty, status);
            });
        } catch (ExpiredDuringFill ex) {
            tx.executeWithoutResult(ignored -> {
                reservations.lock(attemptedPortfolio[0]);
                jdbc.update("UPDATE simulated_orders SET status='EXPIRED',reserved_cash=0,reserved_shares=0,updated_at=NOW() WHERE id=? AND status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED')",attemptedId[0]);
            });
        } catch (OrderConditions.PriceNotEligible ex) {
            defer(attemptedId[0]);
        } catch (ResponseStatusException ex) {
            if (ex.getStatusCode().is5xxServerError()) {
                defer(attemptedId[0]);
                log.warn("Simulated execution temporarily unavailable; will retry: {}", ex.getReason());
                return;
            }
            // A permanent validation/risk failure rejects the order; no settlement was committed.
            String reason = ex.getReason() == null ? "Order rejected by settlement" : ex.getReason();
            try {
                if (attemptedId[0] < 0) return;
                tx.executeWithoutResult(ignored -> {reservations.lock(attemptedPortfolio[0]);jdbc.update("""
                    UPDATE simulated_orders
SET status=CASE WHEN filled_quantity>0 THEN 'CANCELLED' ELSE 'REJECTED' END,
    reserved_cash=0,reserved_shares=0,failure_reason=?,
    updated_at=NOW()
                    WHERE id=? AND status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED')
                    """, reason, attemptedId[0]);});
            } catch (Exception failure) { log.warn("Unable to persist rejection", failure); }
            log.warn("Simulated execution rejected: {}", reason);
        } catch (Exception ex) {
            // Transient market/FX or infrastructure failures must not silently reject orders.
            defer(attemptedId[0]);
            log.warn("Simulated exchange cycle rolled back; will retry: {}", ex.toString());
        }
    }
    private static class ExpiredDuringFill extends RuntimeException {}

    private void defer(long orderId) {
        if(orderId<0) return;
        try {tx.executeWithoutResult(ignored -> jdbc.update("UPDATE simulated_orders SET updated_at=NOW() WHERE id=? AND status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED')",orderId));}
        catch(Exception ex){log.warn("Unable to defer order {}",orderId);}
    }

}
