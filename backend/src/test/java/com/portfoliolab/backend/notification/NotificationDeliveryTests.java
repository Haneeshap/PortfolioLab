package com.portfoliolab.backend.notification;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.*;
import org.springframework.kafka.core.KafkaTemplate;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class NotificationDeliveryTests {
 @Test void failedKafkaSendLeavesOutboxPendingAndStopsBatch(){
  var jdbc=mock(JdbcTemplate.class);
  KafkaTemplate<String,String> kafka=mock(KafkaTemplate.class);
  var first=new NotificationOutboxPublisher.PendingEvent(UUID.randomUUID(),1L,"first");
  var second=new NotificationOutboxPublisher.PendingEvent(UUID.randomUUID(),2L,"second");
  when(jdbc.query(anyString(),any(RowMapper.class))).thenReturn(List.of(first,second));
  when(kafka.send(anyString(),anyString(),anyString())).thenReturn(CompletableFuture.failedFuture(new RuntimeException("broker unavailable")));
  new NotificationOutboxPublisher(jdbc,kafka).publishPending();
  verify(kafka).send("portfoliolab.notifications.v1","1","first");
  verifyNoMoreInteractions(kafka);
  verify(jdbc,never()).update(anyString(),any(Object.class));
 }
 @Test void onlyAcknowledgedSendMarksOutboxPublished(){
  var jdbc=mock(JdbcTemplate.class);
  KafkaTemplate<String,String> kafka=mock(KafkaTemplate.class);
  var event=new NotificationOutboxPublisher.PendingEvent(UUID.randomUUID(),1L,"payload");
  when(jdbc.query(anyString(),any(RowMapper.class))).thenReturn(List.of(event));
  when(kafka.send(anyString(),anyString(),anyString())).thenReturn(CompletableFuture.completedFuture(null));
  new NotificationOutboxPublisher(jdbc,kafka).publishPending();
  var order=inOrder(kafka,jdbc);
  order.verify(kafka).send("portfoliolab.notifications.v1","1","payload");
  order.verify(jdbc).update(contains("SET published_at = NOW()"),eq(event.eventId()));
 }
}
