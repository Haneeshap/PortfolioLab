package com.portfoliolab.backend.oms;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.math.BigDecimal;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
class OrderEventStreamTests {
 @Test void notificationHintsArePortfolioScopedAndReconnectAlwaysResets() throws Exception {
  var jdbc=mock(JdbcTemplate.class);
  when(jdbc.queryForObject(anyString(),eq(Long.class),eq(1L))).thenReturn(0L);
  when(jdbc.queryForList(contains("FROM notifications"),eq(Long.class),eq(1L),eq(0L))).thenReturn(List.of(7L));
  var stream=new OrderEventStream(jdbc);
  var mvc=MockMvcBuilders.standaloneSetup(new OrderEventController(stream)).build();
  var first=mvc.perform(get("/api/portfolios/1/simulated-orders/events")).andReturn();
  stream.dispatch();
  assertTrue(first.getResponse().getContentAsString().contains("event:notification"));
  verify(jdbc).queryForList(contains("portfolio_id=? AND id>?"),eq(Long.class),eq(1L),eq(0L));
  var reconnect=mvc.perform(get("/api/portfolios/1/simulated-orders/events").header("Last-Event-ID","0")).andReturn();
  assertTrue(reconnect.getResponse().getContentAsString().contains("event:reset"));
 }
 @Test void emitsResetThenOrderedCommittedEventsAndResumesCursor() throws Exception {
  var jdbc=mock(JdbcTemplate.class);
  when(jdbc.queryForObject(anyString(),eq(Long.class),eq(1L))).thenReturn(43L);
  when(jdbc.query(anyString(),any(RowMapper.class),eq(1L),eq(42L))).thenReturn(List.of(new OrderEventStream.Event(43,1,7,"PARTIALLY_FILLED",new BigDecimal("4"),new BigDecimal("2"))));
  var stream=new OrderEventStream(jdbc);
  var mvc=MockMvcBuilders.standaloneSetup(new OrderEventController(stream)).build();
  var result=mvc.perform(get("/api/portfolios/1/simulated-orders/events").header("Last-Event-ID","42")).andReturn();
  assertTrue(result.getRequest().isAsyncStarted());
  stream.dispatch();
  String body=result.getResponse().getContentAsString();
  assertTrue(body.contains("event:reset"),body);
  assertTrue(body.contains("id:43"),body);
  assertTrue(body.contains("PARTIALLY_FILLED"),body);
  assertTrue(body.contains("filledQuantity"),body);
  verify(jdbc).query(contains("portfolio_id=? AND id>? ORDER BY id LIMIT 100"),any(RowMapper.class),eq(1L),eq(42L));
 }
 @Test void otherPortfolioCannotSubscribe(){
  var jdbc=mock(JdbcTemplate.class);var stream=new OrderEventStream(jdbc);
  assertThrows(org.springframework.web.server.ResponseStatusException.class,()->stream.connect(2,null));
  verifyNoInteractions(jdbc);
 }
 @Test void malformedOrFutureCursorStartsAtCurrentJournalAndResets(){
  var jdbc=mock(JdbcTemplate.class);
  when(jdbc.queryForObject(anyString(),eq(Long.class),eq(1L))).thenReturn(43L);
  var stream=new OrderEventStream(jdbc);
  stream.connect(1,"999999");stream.dispatch();
  verify(jdbc).query(anyString(),any(RowMapper.class),eq(1L),eq(43L));
 }
}
