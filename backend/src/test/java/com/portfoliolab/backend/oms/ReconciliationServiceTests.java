package com.portfoliolab.backend.oms;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReconciliationServiceTests {
    private static final String DETAILS = "Inconsistent simulated order, execution receipt, or settled trade";

    private static JdbcTemplate jdbcWithRows(List<Map<String, Object>> rows) {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(contains("FROM portfolios"), eq(Integer.class), eq(1L))).thenReturn(1);
        when(jdbc.queryForObject(contains("FROM simulated_orders"), eq(Integer.class), eq(1L))).thenReturn(rows.size());
        when(jdbc.query(anyString(), any(RowMapper.class), eq(1L))).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            RowMapper<ReconciliationService.ExceptionItem> mapper = invocation.getArgument(1);
            java.util.ArrayList<ReconciliationService.ExceptionItem> result = new java.util.ArrayList<>();
            int index = 0;
            for (Map<String, Object> row : rows) {
                java.sql.ResultSet rs = mock(java.sql.ResultSet.class);
                when(rs.getLong("id")).thenReturn(((Number) row.get("id")).longValue());
                when(rs.getString("code")).thenReturn((String) row.get("code"));
                result.add(mapper.mapRow(rs, index++));
            }
            return result;
        });
        return jdbc;
    }

    @Test
    void consistentOrderProducesNoExceptions() {
        JdbcTemplate jdbc = jdbcWithRows(List.of(Map.of("id", 2L, "code", "")));
        // The SQL returns NULL for consistent orders. Override the mocked row accordingly.
        when(jdbc.query(anyString(), any(RowMapper.class), eq(1L))).thenAnswer(invocation -> {
            java.sql.ResultSet rs = mock(java.sql.ResultSet.class);
            when(rs.getLong("id")).thenReturn(2L);
            when(rs.getString("code")).thenReturn(null);
            @SuppressWarnings("unchecked")
            RowMapper<ReconciliationService.ExceptionItem> mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(rs, 0));
        });
        var report = new ReconciliationService(jdbc).reconcile(1L);
        assertEquals(1, report.checkedOrders());
        assertEquals(0, report.exceptionCount());
        assertTrue(report.exceptions().isEmpty());
    }

    @Test
    void reportedQuantityMismatchIsReturned() {
        JdbcTemplate jdbc = jdbcWithRows(List.of(Map.of("id", 2L, "code", "ORDER_FILLED_QUANTITY_MISMATCH")));
        var report = new ReconciliationService(jdbc).reconcile(1L);
        assertEquals(1, report.exceptionCount());
        assertEquals(2L, report.exceptions().get(0).orderId());
        assertEquals("ORDER_FILLED_QUANTITY_MISMATCH", report.exceptions().get(0).code());
        assertEquals(DETAILS, report.exceptions().get(0).details());
    }

    @Test
    void mismatchedExecutionAndTransactionIsReturned() {
        JdbcTemplate jdbc = jdbcWithRows(List.of(Map.of("id", 2L, "code", "EXECUTION_TRANSACTION_MISMATCH")));
        var report = new ReconciliationService(jdbc).reconcile(1L);
        assertEquals("EXECUTION_TRANSACTION_MISMATCH", report.exceptions().get(0).code());
    }

    @Test
    void missingSettlementLinkIsReturned() {
        JdbcTemplate jdbc = jdbcWithRows(List.of(Map.of("id", 2L, "code", "MISSING_SETTLEMENT_LINK")));
        var report = new ReconciliationService(jdbc).reconcile(1L);
        assertEquals("MISSING_SETTLEMENT_LINK", report.exceptions().get(0).code());
    }

    @Test
    void unknownPortfolioReturnsNotFound() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(999L))).thenReturn(0);
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> new ReconciliationService(jdbc).reconcile(999L));
        assertEquals(404, error.getStatusCode().value());
        verify(jdbc, never()).query(anyString(), any(RowMapper.class), anyLong());
    }
}