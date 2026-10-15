package com.portfoliolab.backend.oms;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/** Uses the configured development PostgreSQL database. Every mutation is rolled back. */
@SpringBootTest
@Transactional
class ReconciliationSqlIntegrationTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired ReconciliationService reconciliation;

    record Receipt(long id, long orderId, long portfolioId, BigDecimal quantity) {}

    private Receipt findSettledReceipt() {
        return jdbc.query("""
            SELECT e.id, e.order_id, o.portfolio_id, e.quantity
            FROM simulated_exchange_executions e
            JOIN simulated_orders o ON o.id = e.order_id
            WHERE o.filled_quantity > 0
            ORDER BY e.id
            LIMIT 1
            """, rs -> {
                if (!rs.next()) return null;
                return new Receipt(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getBigDecimal(4));
            });
    }

    @Test
    void databaseQueryDetectsReceiptQuantityMismatchAndTransactionRollsBack() {
        Receipt receipt = findSettledReceipt();
        assertNotNull(receipt, "Requires at least one simulated order with an execution receipt");

        var baseline = reconciliation.reconcile(receipt.portfolioId());
        boolean baselineMismatch = baseline.exceptions().stream().anyMatch(e ->
            e.orderId() == receipt.orderId() &&
            "EXECUTION_TRANSACTION_MISMATCH".equals(e.code()));
        assertFalse(baselineMismatch, "Order already has an execution/transaction mismatch; resolve it first");

        // Change only the execution receipt within this test transaction.
        // The transaction, fill record, and order totals remain unchanged.
        int updated = jdbc.update(
            "UPDATE simulated_exchange_executions SET quantity = ? WHERE id = ?",
            receipt.quantity().add(BigDecimal.ONE), receipt.id());
        assertEquals(1, updated);

        var report = reconciliation.reconcile(receipt.portfolioId());
        assertTrue(report.exceptions().stream().anyMatch(e ->
            e.orderId() == receipt.orderId() &&
            "EXECUTION_TRANSACTION_MISMATCH".equals(e.code())),
            () -> "Expected SQL-level mismatch; actual exceptions: " + report.exceptions());
        // Spring @Transactional automatically rolls back test changes after the test.
    }
}