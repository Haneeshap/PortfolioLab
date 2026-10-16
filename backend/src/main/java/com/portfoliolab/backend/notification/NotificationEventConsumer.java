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
        if (!NotificationPreferences.TYPES.contains(type)) throw new IllegalArgumentException("Unsupported notification event type");
        UUID receipt = UUID.fromString(event.path("eventId").asText());
        long owner = event.path("portfolioId").asLong();
        if (owner <= 0) throw new IllegalArgumentException("Invalid portfolio");
        if (jdbc.update("INSERT INTO notification_receipts(event_id) VALUES (?) ON CONFLICT DO NOTHING", receipt) == 0) return;
        Boolean enabled = jdbc.queryForObject("SELECT COALESCE((SELECT enabled FROM notification_preferences WHERE portfolio_id=? AND event_type=?),TRUE)", Boolean.class, owner, type);
        if (!Boolean.TRUE.equals(enabled)) return;
        // OMS fills already have an order-status notification. Keep legacy synchronous trade notices.
        if ("TRADE_EXECUTED".equals(type) && Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM simulated_exchange_executions e JOIN simulated_orders o ON o.id=e.order_id WHERE e.transaction_id=? AND o.portfolio_id=?)", Boolean.class, event.path("transactionId").asLong(), owner))) return;
        if (type.startsWith("ORDER_") || "AGENT_INSIGHT".equals(type) || "DIVIDEND_CREDITED".equals(type) || "PRICE_ALERT".equals(type)) {
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
                    """, id, portfolioId, type.startsWith("ORDER_") ? "ORDER" : "AGENT_INSIGHT".equals(type) ? "AGENT" : "PRICE_ALERT".equals(type) ? "PRICE_ALERT" : "DIVIDEND",
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
