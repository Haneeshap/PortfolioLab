package com.portfoliolab.backend.notification;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class NotificationRetention {
 private final JdbcTemplate jdbc;
 public NotificationRetention(JdbcTemplate jdbc){this.jdbc=jdbc;}
 @Scheduled(fixedDelay=3600000,initialDelay=60000)
 public void prune(){
  jdbc.update("DELETE FROM notifications WHERE id IN (SELECT id FROM notifications WHERE created_at < NOW()-INTERVAL '90 days' ORDER BY id LIMIT 1000)");
  jdbc.update("DELETE FROM notification_outbox WHERE event_id IN (SELECT event_id FROM notification_outbox WHERE published_at < NOW()-INTERVAL '90 days' ORDER BY published_at LIMIT 1000)");
 }
}
