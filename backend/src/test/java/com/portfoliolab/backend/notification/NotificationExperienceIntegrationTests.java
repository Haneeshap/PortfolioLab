package com.portfoliolab.backend.notification;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class NotificationExperienceIntegrationTests {
 @Autowired JdbcTemplate jdbc;
 @Autowired NotificationEventConsumer consumer;
 @Autowired NotificationPreferences preferences;
 @Autowired NotificationController notifications;
 @Autowired ActivityController activity;
 @Autowired com.portfoliolab.backend.market.PriceAlertService alerts;
 long portfolio(){return jdbc.queryForObject("INSERT INTO portfolios(name,cash_balance,currency) VALUES('M41 test',1000,'INR') RETURNING id",Long.class);}
 String event(long p,UUID id){return "{\"eventId\":\""+id+"\",\"portfolioId\":"+p+",\"eventType\":\"PRICE_ALERT\",\"title\":\"Test crossing\",\"message\":\"Simulated threshold crossed\",\"targetUrl\":\"/alerts\"}";}
 @Test void existingPriceAlertCrossingEmitsOnceAndRespectsPreferences() throws Exception {
  long p=portfolio();
  jdbc.update("INSERT INTO market_price_alerts(portfolio_id,symbol,currency,direction,target_price,last_price) VALUES(?,'M41TEST','INR','ABOVE',100,90)",p);
  var quote=new com.portfoliolab.backend.market.MarketPrice("M41TEST",new java.math.BigDecimal("101"),"INR",java.time.Instant.now());
  alerts.evaluate(quote);alerts.evaluate(quote);
  assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM notification_outbox WHERE portfolio_id=? AND event_type='PRICE_ALERT'",Integer.class,p));
  preferences.put(p,Map.of("PRICE_ALERT",false));
  consumer.consume(jdbc.queryForObject("SELECT payload FROM notification_outbox WHERE portfolio_id=?",String.class,p));
  assertTrue(notifications.list(p,Long.MAX_VALUE,50).isEmpty());
  assertEquals("TRIGGERED",jdbc.queryForObject("SELECT status FROM market_price_alerts WHERE portfolio_id=?",String.class,p));
 }
 @Test void duplicatesPreferencesReadStateAndPortfolioIsolation() throws Exception {
  long p=portfolio(),other=portfolio();var id=UUID.randomUUID();
  consumer.consume(event(p,id));consumer.consume(event(p,id));
  assertEquals(1,notifications.list(p,Long.MAX_VALUE,50).size());
  assertTrue(notifications.list(other,Long.MAX_VALUE,50).isEmpty());
  long notice=notifications.list(p,Long.MAX_VALUE,50).getFirst().id();
  assertThrows(org.springframework.web.server.ResponseStatusException.class,()->notifications.markRead(other,notice));
  notifications.markRead(p,notice);assertTrue(notifications.list(p,Long.MAX_VALUE,50).getFirst().read());
  notifications.markUnread(p,notice);assertEquals(1L,notifications.unreadCount(p).get("count"));
  preferences.put(p,Map.of("PRICE_ALERT",false));var suppressed=UUID.randomUUID();consumer.consume(event(p,suppressed));
  preferences.put(p,Map.of("PRICE_ALERT",true));consumer.consume(event(p,suppressed));
  assertEquals(1,notifications.list(p,Long.MAX_VALUE,50).size(),"Suppressed events stay suppressed on replay");
  jdbc.update("DELETE FROM notifications WHERE portfolio_id=?",p);consumer.consume(event(p,id));
  assertTrue(notifications.list(p,Long.MAX_VALUE,50).isEmpty(),"Retention cannot resurrect a replay");
 }
 @Test void journalAtomicallyEnqueuesAndTimelineUsesRealRecords() throws Exception {
  long p=portfolio(),other=portfolio();
  long asset=jdbc.queryForObject("SELECT MIN(id) FROM assets",Long.class);
  long order=jdbc.queryForObject("INSERT INTO simulated_orders(portfolio_id,asset_id,side,requested_quantity) VALUES(?,?,'BUY',2) RETURNING id",Long.class,p,asset);
  jdbc.update("UPDATE simulated_orders SET status='CANCELLED' WHERE id=?",order);
  String payload=jdbc.queryForObject("SELECT payload FROM notification_outbox WHERE portfolio_id=? AND event_type='ORDER_CANCELLED'",String.class,p);
  consumer.consume(payload);consumer.consume(payload);
  assertEquals(1,notifications.list(p,Long.MAX_VALUE,50).size());
  var all=activity.list(p,"ALL","9999-12-31T00:00:00Z","~",100);
  assertEquals(2,all.size());assertTrue(all.stream().allMatch(e->e.order_id()==order));
  var first=activity.list(p,"ALL","9999-12-31T00:00:00Z","~",1).getFirst();
  var second=activity.list(p,"ALL",first.occurred_at().toString(),first.key(),1).getFirst();
  assertNotEquals(first.key(),second.key());
  assertEquals(1,activity.list(p,"CANCELLED","9999-12-31T00:00:00Z","~",50).size());
  assertTrue(activity.list(other,"ALL","9999-12-31T00:00:00Z","~",50).isEmpty());
 }
 @Test void rolledBackStatusChangeCannotLeaveAnOutboxEvent(){
  long p=portfolio(),asset=jdbc.queryForObject("SELECT MIN(id) FROM assets",Long.class);
  long order=jdbc.queryForObject("INSERT INTO simulated_orders(portfolio_id,asset_id,side,requested_quantity) VALUES(?,?,'BUY',2) RETURNING id",Long.class,p,asset);
  jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) connection->{
   var savepoint=connection.setSavepoint();
   jdbc.update("UPDATE simulated_orders SET status='CANCELLED' WHERE id=?",order);
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM notification_outbox WHERE portfolio_id=?",Integer.class,p));
   connection.rollback(savepoint);connection.releaseSavepoint(savepoint);return null;
  });
  assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM notification_outbox WHERE portfolio_id=?",Integer.class,p));
  assertEquals(1,activity.list(p,"ALL","9999-12-31T00:00:00Z","~",50).size());
 }
}
