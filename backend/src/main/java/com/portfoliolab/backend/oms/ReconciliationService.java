package com.portfoliolab.backend.oms;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@Service
class ReconciliationService {
    private final JdbcTemplate jdbc;
    ReconciliationService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    record ExceptionItem(long orderId, String code, String details) {}
    record Report(long portfolioId, int checkedOrders, int exceptionCount, List<ExceptionItem> exceptions,
                  String scope) {}

    Report reconcile(long portfolioId) {
        Integer exists = jdbc.queryForObject("SELECT count(*) FROM portfolios WHERE id=?", Integer.class, portfolioId);
        if (exists == null || exists == 0) throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.NOT_FOUND, "Portfolio not found");
        Integer count = jdbc.queryForObject("SELECT count(*) FROM simulated_orders WHERE portfolio_id=?", Integer.class, portfolioId);
        List<ExceptionItem> issues = jdbc.query("""
            WITH receipts AS (
              SELECT order_id, COUNT(*) AS receipt_count, COALESCE(SUM(quantity),0) AS receipt_qty
              FROM simulated_exchange_executions GROUP BY order_id
            ), fills AS (
              SELECT order_id, COUNT(*) AS fill_count, COALESCE(SUM(quantity),0) AS fill_qty
              FROM simulated_order_fills GROUP BY order_id
            ), linked AS (
              SELECT e.order_id,
                     COUNT(*) FILTER (WHERE t.id IS NULL OR f.id IS NULL) AS missing_links,
                     COUNT(*) FILTER (WHERE t.id IS NOT NULL AND (
                         t.portfolio_id <> o.portfolio_id OR t.asset_id <> o.asset_id OR
                         t.transaction_type <> o.side OR t.quantity <> e.quantity OR
                         t.price_per_unit <> e.price_per_unit OR f.quantity <> e.quantity OR
                         f.order_id <> e.order_id OR f.fill_sequence <> e.fill_sequence OR
                         f.transaction_id <> e.transaction_id
                     )) AS mismatched_trades
              FROM simulated_exchange_executions e
              JOIN simulated_orders o ON o.id=e.order_id
              LEFT JOIN transactions t ON t.id=e.transaction_id
              LEFT JOIN simulated_order_fills f ON f.transaction_id=e.transaction_id
              GROUP BY e.order_id
            )
            SELECT o.id,
              CASE
                WHEN COALESCE(l.missing_links,0)>0 THEN 'MISSING_SETTLEMENT_LINK'
                WHEN COALESCE(l.mismatched_trades,0)>0 THEN 'EXECUTION_TRANSACTION_MISMATCH'
                WHEN COALESCE(r.receipt_count,0)<>COALESCE(f.fill_count,0) THEN 'RECEIPT_FILL_COUNT_MISMATCH'
                WHEN COALESCE(r.receipt_qty,0)<>COALESCE(f.fill_qty,0) THEN 'RECEIPT_FILL_QUANTITY_MISMATCH'
                WHEN o.filled_quantity<>COALESCE(r.receipt_qty,0) THEN 'ORDER_FILLED_QUANTITY_MISMATCH'
                WHEN o.status='FILLED' AND o.filled_quantity<>o.requested_quantity THEN 'INVALID_FILLED_STATUS'
                WHEN o.status='PARTIALLY_FILLED' AND (o.filled_quantity<=0 OR o.filled_quantity>=o.requested_quantity) THEN 'INVALID_PARTIAL_STATUS'
                WHEN o.status IN ('SUBMITTED','ACCEPTED','REJECTED') AND o.filled_quantity<>0 THEN 'INVALID_UNFILLED_STATUS'
                WHEN o.status='CANCELLED' AND o.filled_quantity>o.requested_quantity THEN 'INVALID_CANCELLED_STATUS'
                WHEN o.status NOT IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED') AND (o.reserved_cash<>0 OR o.reserved_shares<>0) THEN 'TERMINAL_RESERVATION'
                WHEN o.status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED') AND NOT o.reservation_managed THEN 'LEGACY_UNRESERVED_ORDER'
                WHEN o.reservation_managed AND o.status IN ('SUBMITTED','ACCEPTED','PARTIALLY_FILLED') AND
                 ((o.side='BUY' AND o.cash_per_share<=0) OR o.reserved_cash<>CASE WHEN o.side='BUY' THEN o.cash_per_share*(o.requested_quantity-o.filled_quantity) ELSE 0 END OR
                  o.reserved_shares<>CASE WHEN o.side='SELL' THEN o.requested_quantity-o.filled_quantity ELSE 0 END) THEN 'RESERVATION_QUANTITY_MISMATCH'
                WHEN (SELECT COALESCE(SUM(x.reserved_cash),0) FROM simulated_orders x WHERE x.portfolio_id=o.portfolio_id) > (SELECT cash_balance FROM portfolios WHERE id=o.portfolio_id) THEN 'OVER_RESERVED_CASH'
                WHEN (SELECT COALESCE(SUM(x.reserved_shares),0) FROM simulated_orders x WHERE x.portfolio_id=o.portfolio_id AND x.asset_id=o.asset_id) > (SELECT COALESCE(SUM(quantity),0) FROM holdings WHERE portfolio_id=o.portfolio_id AND asset_id=o.asset_id) THEN 'OVER_RESERVED_SHARES'
                ELSE NULL END AS code
            FROM simulated_orders o
            LEFT JOIN receipts r ON r.order_id=o.id
            LEFT JOIN fills f ON f.order_id=o.id
            LEFT JOIN linked l ON l.order_id=o.id
            WHERE o.portfolio_id=?
            ORDER BY o.id
            """, (rs,n)->new ExceptionItem(rs.getLong("id"),rs.getString("code"),
                    "Inconsistent simulated order, execution receipt, or settled trade"), portfolioId)
                .stream().filter(e -> e.code()!=null).toList();
        return new Report(portfolioId, count == null ? 0 : count, issues.size(), issues,
                "Internal consistency only; receipts and settlements originate in the same Spring Boot worker");
    }
}

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/reconciliation")
class ReconciliationController {
    private final ReconciliationService service;
    ReconciliationController(ReconciliationService service) { this.service=service; }
    @GetMapping
    ReconciliationService.Report report(@PathVariable long portfolioId) {
        return service.reconcile(portfolioId);
    }
}
