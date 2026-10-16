package com.portfoliolab.backend.oms;

import com.portfoliolab.backend.portfolio.*;
import com.portfoliolab.backend.market.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real PostgreSQL transactions, isolated test portfolio, no historical-order mutations.
 * Disable the scheduled worker; tests explicitly process only their own portfolio. */
@SpringBootTest(properties={"oms.worker.initial-delay=3600000"})
class OrderLifecycleIntegrationTests {
 @Autowired JdbcTemplate jdbc;
 @Autowired SimulatedOrderService orders;
 @Autowired SimulatedExchangeWorker worker;
 @Autowired OrderReservations reservations;
 @Autowired ReconciliationService reconciliation;
 @Autowired OrderEventStream events;
 @Autowired PlatformTransactionManager manager;
 @MockitoBean MarketService market;
 @MockitoBean com.portfoliolab.backend.history.PortfolioHistoryRecorder history;
 @MockitoBean com.portfoliolab.backend.notification.NotificationOutboxPublisher notificationPublisher;
 @MockitoBean com.portfoliolab.backend.notification.MarketIntelligenceOutboxPublisher intelligencePublisher;
 @MockitoBean com.portfoliolab.backend.market.PriceAlertService alerts;
 @MockitoBean com.portfoliolab.backend.market.MarketIntelligenceService intelligence;
 @MockitoBean com.portfoliolab.backend.dividend.ScheduledDividendScheduler dividends;
 @MockitoBean com.portfoliolab.backend.risk.PortfolioTradeRiskListener riskListener;
 long portfolioId,assetId;String symbol;
 @BeforeEach void setup() {
  portfolioId=jdbc.queryForObject("INSERT INTO portfolios(name,cash_balance,currency) VALUES('M35-M37 test',1000,'INR') RETURNING id",Long.class);
  var asset=jdbc.queryForMap("SELECT id,symbol FROM assets WHERE currency='INR' ORDER BY id LIMIT 1");
  assetId=((Number)asset.get("id")).longValue();symbol=(String)asset.get("symbol");price("100");
 }
 void price(String value){when(market.getCurrentPrices()).thenAnswer(i->List.of(new MarketPrice(symbol,new BigDecimal(value),"INR",Instant.now())));}
 OrderRequest buy(int qty,String limit){return new OrderRequest(assetId,"BUY",BigDecimal.valueOf(qty),"LIMIT",new BigDecimal(limit),"GTC");}
 void cycle(){worker.executePortfolio(portfolioId);}
 BigDecimal amount(String column,long id){return jdbc.queryForObject("SELECT "+column+" FROM simulated_orders WHERE id=?",BigDecimal.class,id);}
 @AfterEach void cleanup() {
  new TransactionTemplate(manager).executeWithoutResult(tx->{
   jdbc.update("DELETE FROM simulated_order_events WHERE portfolio_id=?",portfolioId);
   jdbc.update("DELETE FROM simulated_exchange_executions WHERE order_id IN (SELECT id FROM simulated_orders WHERE portfolio_id=?)",portfolioId);
   jdbc.update("DELETE FROM simulated_order_fills WHERE order_id IN (SELECT id FROM simulated_orders WHERE portfolio_id=?)",portfolioId);
   jdbc.update("DELETE FROM simulated_orders WHERE portfolio_id=?",portfolioId);
   // Notification/history/risk listeners may have recorded evidence for this test portfolio.
   jdbc.update("DELETE FROM notification_outbox WHERE portfolio_id=?",portfolioId);
   jdbc.update("DELETE FROM transactions WHERE portfolio_id=?",portfolioId);
   jdbc.update("DELETE FROM holdings WHERE portfolio_id=?",portfolioId);
   jdbc.update("DELETE FROM pre_trade_risk_policies WHERE portfolio_id=?",portfolioId);
   jdbc.update("DELETE FROM portfolios WHERE id=?",portfolioId);
  });
 }
 @Test void crossingPartialFillRecrossAndCancelPreserveSettledCash() {
  var o=orders.submit(portfolioId,buy(4,"90"));cycle();cycle();
  assertEquals("ACCEPTED",orders.get(portfolioId,o.id()).status());
  assertEquals(0,amount("filled_quantity",o.id()).signum());
  price("80");cycle();assertEquals("PARTIALLY_FILLED",orders.get(portfolioId,o.id()).status());
  assertEquals(0,amount("reserved_cash",o.id()).compareTo(new BigDecimal("189")));
  price("95");cycle();assertEquals(0,amount("filled_quantity",o.id()).compareTo(new BigDecimal("2")));
  orders.cancel(portfolioId,o.id());assertEquals(0,amount("reserved_cash",o.id()).signum());
  assertEquals(0,jdbc.queryForObject("SELECT cash_balance FROM portfolios WHERE id=?",BigDecimal.class,portfolioId).compareTo(new BigDecimal("840")));
  assertEquals(0,reconciliation.reconcile(portfolioId).exceptionCount());
  assertThrows(RuntimeException.class,()->orders.cancel(portfolioId,o.id()));
 }
 @Test void eligibleMarketAndLimitSettleExactlyOnce() {
  var o=orders.submit(portfolioId,buy(2,"110"));cycle();cycle();cycle();cycle();
  assertEquals("FILLED",orders.get(portfolioId,o.id()).status());
  assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM simulated_exchange_executions WHERE order_id=?",Integer.class,o.id()));
  assertEquals(0,amount("reserved_cash",o.id()).signum());
  var m=orders.submit(portfolioId,new OrderRequest(assetId,"BUY",BigDecimal.ONE));cycle();cycle();
  assertEquals("FILLED",orders.get(portfolioId,m.id()).status());
  assertEquals(0,reconciliation.reconcile(portfolioId).exceptionCount());
 }
 @Test void expiryRetainsPartialFillAndReleasesOnlyRemainder() {
  var o=orders.submit(portfolioId,buy(4,"110"));cycle();cycle();
  jdbc.update("UPDATE simulated_orders SET expires_at=NOW()-INTERVAL '1 second' WHERE id=?",o.id());cycle();
  assertEquals("EXPIRED",orders.get(portfolioId,o.id()).status());
  assertEquals(0,amount("filled_quantity",o.id()).compareTo(new BigDecimal("2")));
  assertEquals(0,amount("reserved_cash",o.id()).signum());
  assertThrows(RuntimeException.class,()->orders.cancel(portfolioId,o.id()));
 }
 @Test void concurrentBuysCannotDoubleReserve() throws Exception {
  var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  try {
   Callable<Boolean> submit=()->{gate.await();try{orders.submit(portfolioId,buy(6,"100"));return true;}catch(org.springframework.web.server.ResponseStatusException ex){return false;}};
   var a=pool.submit(submit);var b=pool.submit(submit);gate.countDown();
   assertNotEquals(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS));
   assertEquals(0,reservations.cash(portfolioId,-1).compareTo(new BigDecimal("630")));
  }finally{pool.shutdownNow();}
 }
 @Test void concurrentSellsCannotDoubleReserve() throws Exception {
  jdbc.update("INSERT INTO holdings(portfolio_id,asset_id,quantity,average_buy_price,historical_cost_portfolio) VALUES(?,?,10,100,1000)",portfolioId,assetId);
  var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  try {
   Callable<Boolean> submit=()->{gate.await();try{orders.submit(portfolioId,new OrderRequest(assetId,"SELL",new BigDecimal("6")));return true;}catch(org.springframework.web.server.ResponseStatusException ex){return false;}};
   var a=pool.submit(submit);var b=pool.submit(submit);gate.countDown();
   assertNotEquals(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS));
   assertEquals(0,reservations.shares(portfolioId,assetId,-1).compareTo(new BigDecimal("6")));
  }finally{pool.shutdownNow();}
 }
 @Test void reservationCorruptionIsReportedWithoutSuppressingSettlementMismatch() {
  var o=orders.submit(portfolioId,buy(4,"110"));cycle();cycle();
  jdbc.update("UPDATE simulated_orders SET reserved_cash=1 WHERE id=?",o.id());
  assertTrue(reconciliation.reconcile(portfolioId).exceptions().stream().anyMatch(e->e.code().equals("RESERVATION_QUANTITY_MISMATCH")));
  jdbc.update("UPDATE simulated_exchange_executions SET quantity=quantity+1 WHERE order_id=?",o.id());
  assertTrue(reconciliation.reconcile(portfolioId).exceptions().stream().anyMatch(e->e.code().equals("EXECUTION_TRANSACTION_MISMATCH")));
 }
 @Test void sellReservationsPreventOversellingAndReleaseOnCancel() {
  jdbc.update("INSERT INTO holdings(portfolio_id,asset_id,quantity,average_buy_price,historical_cost_portfolio) VALUES(?,?,10,100,1000)",portfolioId,assetId);
  var sell=new OrderRequest(assetId,"SELL",new BigDecimal("6"));
  var o=orders.submit(portfolioId,sell);
  assertThrows(RuntimeException.class,()->orders.submit(portfolioId,sell));
  cycle();cycle();
  assertEquals(0,amount("reserved_shares",o.id()).compareTo(new BigDecimal("3")));
  orders.cancel(portfolioId,o.id());assertEquals(0,reservations.shares(portfolioId,assetId,-1).signum());
 }
 @Test void failedSettlementReleasesReservationsAndNoFillEvidence() {
  var o=orders.submit(portfolioId,buy(1,"100"));cycle();
  jdbc.update("INSERT INTO pre_trade_risk_policies(portfolio_id,max_order_value,max_position_pct,enabled) VALUES(?,1,100,true)",portfolioId);
  cycle();assertEquals("REJECTED",orders.get(portfolioId,o.id()).status());
  assertEquals(0,amount("reserved_cash",o.id()).signum());
  assertEquals(0,amount("filled_quantity",o.id()).signum());
 }
 @Test void journalRollsBackAndSupportsScopedOrderedReplay() {
  var tx=new TransactionTemplate(manager);
  tx.executeWithoutResult(status->{orders.submit(portfolioId,buy(1,"100"));status.setRollbackOnly();});
  assertTrue(events.read(portfolioId,0).isEmpty());
  var o=orders.submit(portfolioId,buy(1,"100"));cycle();cycle();
  var journal=events.read(portfolioId,0);
  assertEquals(List.of("SUBMITTED","ACCEPTED","FILLED"),journal.stream().map(OrderEventStream.Event::status).toList());
  assertEquals(1,events.read(portfolioId,journal.get(1).eventId()).size());
  assertTrue(journal.stream().allMatch(e->e.portfolioId()==portfolioId&&e.orderId()==o.id()));
 }
}
