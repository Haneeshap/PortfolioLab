package com.portfoliolab.backend.notification;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** A view over authoritative records, never a second financial ledger. */
@RestController
@RequestMapping("/api/portfolios/{portfolioId}/activity")
public class ActivityController {
 private final JdbcTemplate jdbc;
 public record Entry(String key,java.time.OffsetDateTime occurred_at,String type,Long order_id,Long transaction_id,String description) {}
 public ActivityController(JdbcTemplate jdbc){this.jdbc=jdbc;}
 @GetMapping public List<Entry> list(@PathVariable long portfolioId,
  @RequestParam(defaultValue="ALL") String type,
  @RequestParam(defaultValue="9999-12-31T00:00:00Z") String beforeTime,
  @RequestParam(defaultValue="~") String beforeKey,
  @RequestParam(defaultValue="50") int limit){
  if(!Set.of("ALL","SUBMITTED","ACCEPTED","PARTIALLY_FILLED","FILLED","CANCELLED","EXPIRED","REJECTED","SETTLED","DIVIDEND","LEGACY_ORDER").contains(type))
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported activity type");
  java.time.OffsetDateTime before;
  try{before=java.time.OffsetDateTime.parse(beforeTime);}catch(Exception ex){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid cursor time");}
  return jdbc.query("""
   WITH activity AS (
    SELECT 'order:' || e.id AS key, e.created_at AS occurred_at,e.status AS type,
     e.order_id,NULL::bigint AS transaction_id,
     'Order #' || e.order_id || ': ' || e.status || ' (' || e.filled_quantity || '/' || e.requested_quantity || ' filled)' AS description
    FROM simulated_order_events e WHERE e.portfolio_id=?
    UNION ALL
    SELECT 'transaction:' || t.id,t.created_at,'SETTLED',o.id,t.id,
     'Simulated ' || t.transaction_type || ' settlement: ' || t.quantity || ' units; transaction #' || t.id
    FROM transactions t LEFT JOIN simulated_exchange_executions x ON x.transaction_id=t.id
    LEFT JOIN simulated_orders o ON o.id=x.order_id AND o.portfolio_id=t.portfolio_id WHERE t.portfolio_id=?
    UNION ALL
    SELECT 'dividend:' || d.id,d.created_at,'DIVIDEND',NULL::bigint,NULL::bigint,
     'Simulated dividend: ' || d.amount || ' ' || d.currency FROM simulated_dividend_payments d WHERE d.portfolio_id=?
    UNION ALL
    SELECT 'legacy:' || o.id,o.created_at,'LEGACY_ORDER',o.id,NULL::bigint,
     'Order #' || o.id || ': current status ' || o.status || '; detailed lifecycle unavailable'
    FROM simulated_orders o WHERE o.portfolio_id=? AND NOT EXISTS(SELECT 1 FROM simulated_order_events e WHERE e.order_id=o.id)
   )
   SELECT * FROM activity WHERE (?='ALL' OR type=?) AND (occurred_at,key)<(?,?)
   ORDER BY occurred_at DESC,key DESC LIMIT ?
   """,(rs,n)->new Entry(rs.getString("key"),rs.getObject("occurred_at",java.time.OffsetDateTime.class),rs.getString("type"),rs.getObject("order_id",Long.class),rs.getObject("transaction_id",Long.class),rs.getString("description")),portfolioId,portfolioId,portfolioId,portfolioId,type,type,before,beforeKey,Math.max(1,Math.min(100,limit)));
 }
}
