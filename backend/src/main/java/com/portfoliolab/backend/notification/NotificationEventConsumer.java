package com.portfoliolab.backend.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Component
public class NotificationEventConsumer {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public NotificationEventConsumer(
            JdbcTemplate jdbc,
            ObjectMapper mapper
    ) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Transactional
    @KafkaListener(topics = "portfoliolab.notifications.v1")
    public void consume(String payload) throws Exception {

        JsonNode event = mapper.readTree(payload);

        String type = event.path("eventType").asText();
        if ("AGENT_INSIGHT".equals(type) || "DIVIDEND_CREDITED".equals(type)) {
            UUID id = UUID.fromString(event.path("eventId").asText());
            long portfolioId = event.path("portfolioId").asLong();
            String title = event.path("title").asText();
            String message = event.path("message").asText();
            String targetUrl = event.path("targetUrl").asText("/portfolio");
            if (portfolioId <= 0 || title.isBlank() || message.isBlank() ||
                    !targetUrl.startsWith("/") || targetUrl.startsWith("//"))
                throw new IllegalArgumentException("Invalid portfolio notification event");
            jdbc.update("""
                    INSERT INTO notifications
                        (event_id, portfolio_id, source, title, message, target_url)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT (event_id) DO NOTHING
                    """, id, portfolioId, "AGENT_INSIGHT".equals(type) ? "AGENT" : "DIVIDEND",
                    title, message, targetUrl);
            return;
        }
        if (!"TRADE_EXECUTED".equals(
                event.path("eventType").asText()
        )) {
            throw new IllegalArgumentException(
                    "Unsupported notification event type"
            );
        }

        UUID eventId = UUID.fromString(
                event.path("eventId").asText()
        );

        long portfolioId = event.path("portfolioId").asLong();
        long transactionId = event.path("transactionId").asLong();

        String symbol = event.path("symbol").asText();
        String side = event.path("side").asText();
        String quantity = event.path("quantity").asText();

        if (portfolioId <= 0 || transactionId <= 0 ||
                symbol.isBlank() || quantity.isBlank() ||
                (!"BUY".equals(side) && !"SELL".equals(side))) {
            throw new IllegalArgumentException(
                    "Invalid trade notification payload"
            );
        }

        String title = "Simulated trade executed";

        String message = String.format(
                "%s %s units of %s. Transaction #%d.",
                "BUY".equals(side) ? "Bought" : "Sold",
                quantity,
                symbol,
                transactionId
        );

        jdbc.update(
                """
                INSERT INTO notifications
                    (event_id, portfolio_id, source, title,
                     message, target_url)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (event_id) DO NOTHING
                """,
                eventId,
                portfolioId,
                "TRADE",
                title,
                message,
                "/portfolio"
        );
    }
}