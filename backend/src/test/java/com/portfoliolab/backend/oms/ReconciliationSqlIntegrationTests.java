package com.portfoliolab.backend.oms;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/** Creates its own settled receipt in the configured isolated test database; all changes roll back. */
@SpringBootTest(properties={"oms.worker.initial-delay=3600000"})
@Transactional
class ReconciliationSqlIntegrationTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired ReconciliationService reconciliation;

    @Autowired SimulatedOrderService orders;
    @Autowired SimulatedExchangeWorker worker;
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    com.portfoliolab.backend.market.MarketService market;

    record Receipt(long id, long orderId, long portfolioId, BigDecimal quantity) {}

    private Receipt findSettledReceipt(long portfolioId) {
        return jdbc.query("""
            SELECT e.id, e.order_id, o.portfolio_id, e.quantity
            FROM simulated_exchange_executions e
            JOIN simulated_orders o ON o.id = e.order_id
            WHERE o.filled_quantity > 0 AND o.portfolio_id = ?
            ORDER BY e.id
            LIMIT 1
            """, rs -> {
                if (!rs.next()) return null;
                return new Receipt(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getBigDecimal(4));
            }, portfolioId);
    }

    @Test
    void databaseQueryDetectsReceiptQuantityMismatchAndTransactionRollsBack() {
        long portfolioId = jdbc.queryForObject("INSERT INTO portfolios(name,cash_balance,currency) VALUES('M50 reconciliation fixture',10000,'INR') RETURNING id", Long.class);
        var asset = jdbc.queryForMap("SELECT id,symbol FROM assets WHERE currency='INR' ORDER BY id LIMIT 1");
        long assetId = ((Number) asset.get("id")).longValue();
        org.mockito.Mockito.when(market.getCurrentPrices()).thenAnswer(ignored -> java.util.List.of(
                new com.portfoliolab.backend.market.MarketPrice((String) asset.get("symbol"), new BigDecimal("100"), "INR", java.time.Instant.now())));
        var order = orders.submit(portfolioId, new com.portfoliolab.backend.portfolio.OrderRequest(assetId, "BUY", BigDecimal.ONE));
        worker.executePortfolio(portfolioId); // accepted
        worker.executePortfolio(portfolioId); // settled, using the real settlement path
        assertEquals("FILLED", orders.get(portfolioId, order.id()).status());
        Receipt receipt = findSettledReceipt(portfolioId);
        assertNotNull(receipt, "The isolated fixture must create an execution receipt");

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