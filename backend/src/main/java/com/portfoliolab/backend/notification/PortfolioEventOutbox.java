package com.portfoliolab.backend.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.UUID;

@Component
public class PortfolioEventOutbox {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public PortfolioEventOutbox(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }
    public void record(long portfolioId, String type, Map<String, Object> attributes) {
        try {
            UUID id = UUID.randomUUID();
            var event = new java.util.HashMap<String, Object>(attributes);
            event.put("eventId", id.toString());
            event.put("eventType", type);
            event.put("portfolioId", portfolioId);
            jdbc.update("INSERT INTO notification_outbox (event_id, event_type, portfolio_id, payload) VALUES (?, ?, ?, ?)",
                    id, type, portfolioId, mapper.writeValueAsString(event));
        } catch (Exception e) {
            throw new IllegalStateException("Unable to record portfolio event", e);
        }
    }
}