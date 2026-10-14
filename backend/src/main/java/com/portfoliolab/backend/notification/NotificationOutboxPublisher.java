package com.portfoliolab.backend.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Component
public class NotificationOutboxPublisher {

    private static final Logger log =
            LoggerFactory.getLogger(NotificationOutboxPublisher.class);

    private static final String TOPIC =
            "portfoliolab.notifications.v1";

    private final JdbcTemplate jdbc;
    private final KafkaTemplate<String, String> kafka;

    public NotificationOutboxPublisher(
            JdbcTemplate jdbc,
            KafkaTemplate<String, String> kafka
    ) {
        this.jdbc = jdbc;
        this.kafka = kafka;
    }

    record PendingEvent(UUID eventId, Long portfolioId, String payload) {}

    @Scheduled(fixedDelay = 2000)
    public void publishPending() {

        List<PendingEvent> pending = jdbc.query(
                """
                SELECT event_id, portfolio_id, payload
                FROM notification_outbox
                WHERE published_at IS NULL
                ORDER BY created_at, event_id
                LIMIT 25
                """,
                (rs, rowNum) -> new PendingEvent(
                        rs.getObject("event_id", UUID.class),
                        rs.getLong("portfolio_id"),
                        rs.getString("payload")
                )
        );

        for (PendingEvent event : pending) {
            try {
                kafka.send(
                        TOPIC,
                        event.portfolioId().toString(),
                        event.payload()
                ).get(10, TimeUnit.SECONDS);

                jdbc.update(
                        """
                        UPDATE notification_outbox
                        SET published_at = NOW()
                        WHERE event_id = ?
                          AND published_at IS NULL
                        """,
                        event.eventId()
                );

            } catch (Exception exception) {
                log.warn(
                        "Notification event {} could not be published; will retry",
                        event.eventId(),
                        exception
                );

                break;
            }
        }
    }
}