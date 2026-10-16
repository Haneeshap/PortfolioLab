package com.portfoliolab.backend.oms;
import com.portfoliolab.backend.portfolio.*;
import com.portfoliolab.backend.asset.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class OrderReservationsTests {
 @Test void competingBuysCannotSpendReservedCash() {
  JdbcTemplate jdbc=mock(JdbcTemplate.class);
  var p=mock(Portfolio.class);var a=mock(Asset.class);
  when(p.getId()).thenReturn(1L);when(p.getCashBalance()).thenReturn(new BigDecimal("1000"));
  when(jdbc.queryForObject(contains("SUM(reserved_cash)"),eq(BigDecimal.class),eq(1L),eq(-1L))).thenReturn(new BigDecimal("630"));
  var service=new OrderReservations(jdbc,null,null,null,null);
  assertThrows(RuntimeException.class,()->service.enforce(p,a,"BUY",BigDecimal.ONE,new BigDecimal("600"),-1));
  assertDoesNotThrow(()->service.enforce(p,a,"BUY",BigDecimal.ONE,new BigDecimal("370"),-1));
 }
 @Test void competingSellsCannotCommitSameShares() {
  JdbcTemplate jdbc=mock(JdbcTemplate.class);var p=mock(Portfolio.class);var a=mock(Asset.class);
  when(p.getId()).thenReturn(1L);when(a.getId()).thenReturn(2L);
  when(jdbc.queryForObject(contains("SUM(quantity)"),eq(BigDecimal.class),eq(1L),eq(2L))).thenReturn(new BigDecimal("10"));
  when(jdbc.queryForObject(contains("SUM(reserved_shares)"),eq(BigDecimal.class),eq(1L),eq(2L),eq(-1L))).thenReturn(new BigDecimal("6"));
  var service=new OrderReservations(jdbc,null,null,null,null);
  assertThrows(RuntimeException.class,()->service.enforce(p,a,"SELL",new BigDecimal("5"),BigDecimal.ONE,-1));
  assertDoesNotThrow(()->service.enforce(p,a,"SELL",new BigDecimal("4"),BigDecimal.ONE,-1));
 }
 @Test void missingPortfolioCannotBeLocked() {
  var jdbc=mock(JdbcTemplate.class);
  assertThrows(RuntimeException.class,()->new OrderReservations(jdbc,null,null,null,null).lock(1));
 }
}
