package com.portfoliolab.backend.notification;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/notifications/preferences")
public class NotificationPreferences {
 public static final Set<String> TYPES = Set.of("ORDER_FILLED","ORDER_PARTIALLY_FILLED","ORDER_CANCELLED","ORDER_EXPIRED","PRICE_ALERT","TRADE_EXECUTED","DIVIDEND_CREDITED","AGENT_INSIGHT");
 private final JdbcTemplate jdbc;
 public NotificationPreferences(JdbcTemplate jdbc){this.jdbc=jdbc;}
 @GetMapping public Map<String,Boolean> get(@PathVariable long portfolioId){
  var result=new TreeMap<String,Boolean>(); TYPES.forEach(t->result.put(t,true));
  jdbc.query("SELECT event_type,enabled FROM notification_preferences WHERE portfolio_id=?",rs->{result.put(rs.getString(1),rs.getBoolean(2));},portfolioId);
  return result;
 }
 @PutMapping @Transactional public Map<String,Boolean> put(@PathVariable long portfolioId,@RequestBody Map<String,Boolean> settings){
  if(settings.size()>TYPES.size() || !TYPES.containsAll(settings.keySet()) || settings.values().stream().anyMatch(Objects::isNull)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown event type or missing enabled value");
  settings.forEach((type,enabled)->jdbc.update("INSERT INTO notification_preferences(portfolio_id,event_type,enabled) VALUES(?,?,?) ON CONFLICT(portfolio_id,event_type) DO UPDATE SET enabled=EXCLUDED.enabled",portfolioId,type,enabled));
  return get(portfolioId);
 }
}
