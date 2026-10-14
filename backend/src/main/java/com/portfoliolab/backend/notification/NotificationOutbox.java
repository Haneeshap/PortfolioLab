package com.portfoliolab.backend.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Component
public class NotificationOutbox {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public NotificationOutbox(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void recordTrade(
            Long portfolioId,
            Long transactionId,
            String symbol,
            String side,
            BigDecimal quantity
    ) {
        UUID eventId = UUID.randomUUID();

        Map<String, Object> event = Map.of(
                "eventId", eventId.toString(),
                "eventType", "TRADE_EXECUTED",
                "portfolioId", portfolioId,
                "transactionId", transactionId,
                "symbol", symbol,
                "side", side,
                "quantity", quantity
        );

        final String payload;

        try {
            payload = mapper.writeValueAsString(event);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Unable to serialize trade notification event",
                    exception
            );
        }

        jdbc.update(
                """
                INSERT INTO notification_outbox
                    (event_id, event_type, portfolio_id, payload)
                VALUES (?, ?, ?, ?)
                """,
                eventId,
                "TRADE_EXECUTED",
                portfolioId,
                payload
        );
    }
}