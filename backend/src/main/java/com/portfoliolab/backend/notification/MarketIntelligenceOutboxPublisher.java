package com.portfoliolab.backend.notification;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
public class MarketIntelligenceOutboxPublisher {
 private static final Logger log=LoggerFactory.getLogger(MarketIntelligenceOutboxPublisher.class);
 private final JdbcTemplate jdbc;
 private final KafkaTemplate<String,String> kafka;
 public MarketIntelligenceOutboxPublisher(JdbcTemplate jdbc,KafkaTemplate<String,String> kafka){this.jdbc=jdbc;this.kafka=kafka;}
 record Pending(long id,long intelligenceId,String payload){}
 @Scheduled(fixedDelay=3000,initialDelay=15000)
 public void publish(){
  List<Pending> events=jdbc.query("SELECT event_id,intelligence_id,payload FROM market_intelligence_outbox WHERE published_at IS NULL ORDER BY event_id LIMIT 25",
   (rs,n)->new Pending(rs.getLong(1),rs.getLong(2),rs.getString(3)));
  for(Pending e:events){
   try{
    kafka.send("portfoliolab.market-intelligence.v1",Long.toString(e.intelligenceId()),e.payload()).get(10,TimeUnit.SECONDS);
    jdbc.update("UPDATE market_intelligence_outbox SET published_at=NOW() WHERE event_id=? AND published_at IS NULL",e.id());
   }catch(Exception ex){log.warn("Market intelligence Kafka delivery failed; will retry",ex);break;}
  }
 }
}
