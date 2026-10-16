package com.portfoliolab.backend.oms;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Reads committed journal rows. The journal shares the order's DB transaction,
 * independently of Kafka's notification pipeline. HTTP remains authoritative. */
@Service
public class OrderEventStream {
 private final JdbcTemplate jdbc;
 private final Set<Client> clients=ConcurrentHashMap.newKeySet();
 static final class Client {
  final long portfolioId; final SseEmitter emitter; long cursor; long notificationCursor;
  Client(long portfolioId,SseEmitter emitter,long cursor){this.portfolioId=portfolioId;this.emitter=emitter;this.cursor=cursor;}
 }
 public record Event(long eventId,long portfolioId,long orderId,String status,BigDecimal requestedQuantity,BigDecimal filledQuantity) {}
 public OrderEventStream(JdbcTemplate jdbc){this.jdbc=jdbc;}
 List<Event> read(long portfolioId,long after) {
  return jdbc.query("SELECT * FROM simulated_order_events WHERE portfolio_id=? AND id>? ORDER BY id LIMIT 100",
   (rs,n)->new Event(rs.getLong("id"),rs.getLong("portfolio_id"),rs.getLong("order_id"),rs.getString("status"),rs.getBigDecimal("requested_quantity"),rs.getBigDecimal("filled_quantity")),portfolioId,after);
 }
 public synchronized SseEmitter connect(long portfolioId,String lastId) {
  // Same single-user demo boundary as Next's existing OMS proxy. Never offer arbitrary portfolio subscriptions.
  if(portfolioId!=1) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Portfolio stream not found");
  if(clients.size()>=100) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Stream capacity reached");
  long latest=jdbc.queryForObject("SELECT COALESCE(MAX(id),0) FROM simulated_order_events WHERE portfolio_id=?",Long.class,portfolioId);
  long cursor=latest;
  if(lastId!=null) {
   try {cursor=Long.parseLong(lastId);if(cursor<0||cursor>latest)cursor=latest;}
   catch(NumberFormatException ignored){cursor=latest;}
  }
  var emitter=new SseEmitter(120000L);
  var client=new Client(portfolioId,emitter,cursor);
  client.notificationCursor=jdbc.queryForObject("SELECT COALESCE(MAX(id),0) FROM notifications WHERE portfolio_id=?",Long.class,portfolioId);
  emitter.onCompletion(()->clients.remove(client));
  emitter.onTimeout(()->{clients.remove(client);emitter.complete();});
  emitter.onError(error->clients.remove(client));
  try {
   // Every connection refreshes HTTP state, recovering missed events, journal gaps or browser restarts.
   emitter.send(SseEmitter.event().name("reset").data(Map.of("portfolioId",portfolioId)));
   clients.add(client);
  }catch(Exception ex){emitter.completeWithError(ex);}
  return emitter;
 }
 @Scheduled(fixedDelay=1000,scheduler="orderStreamScheduler")
 public void dispatch() {
  for(Client client:clients) {
   try {
    for(Event event:read(client.portfolioId,client.cursor)) {
     client.emitter.send(SseEmitter.event().name("order").id(Long.toString(event.eventId())).data(event));
     client.cursor=event.eventId();
    }
    var notices=jdbc.queryForList("SELECT id FROM notifications WHERE portfolio_id=? AND id>? ORDER BY id LIMIT 100",Long.class,client.portfolioId,client.notificationCursor);
    if(!notices.isEmpty()) {
     client.emitter.send(SseEmitter.event().name("notification").data(Map.of("portfolioId",client.portfolioId)));
     client.notificationCursor=notices.getLast();
    }
    client.emitter.send(SseEmitter.event().comment("heartbeat"));
   }catch(Exception ex){clients.remove(client);client.emitter.completeWithError(ex);}
  }
 }
}

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/simulated-orders/events")
class OrderEventController {
 private final OrderEventStream stream;
 OrderEventController(OrderEventStream stream){this.stream=stream;}
 @GetMapping(produces="text/event-stream")
 SseEmitter events(@PathVariable long portfolioId,@RequestHeader(value="Last-Event-ID",required=false) String lastId){return stream.connect(portfolioId,lastId);}
}

@org.springframework.context.annotation.Configuration
class OrderStreamScheduling {
 @org.springframework.context.annotation.Bean
 org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler taskScheduler() {
  var scheduler=new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();
  scheduler.setPoolSize(1);scheduler.setThreadNamePrefix("portfolio-tasks-");return scheduler;
 }

 @org.springframework.context.annotation.Bean
 org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler orderStreamScheduler() {
  var scheduler=new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();
  scheduler.setPoolSize(1);scheduler.setThreadNamePrefix("order-events-");return scheduler;
 }
}
