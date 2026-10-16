package com.portfoliolab.backend.notification;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/notifications")
public class NotificationController {

    private final JdbcTemplate jdbc;

    public NotificationController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record NotificationView(
            Long id,
            String source,
            String title,
            String message,
            String targetUrl,
            Instant createdAt,
            boolean read
    ) {}

    @GetMapping
    public List<NotificationView> list(
            @PathVariable Long portfolioId,
            @RequestParam(defaultValue="9223372036854775807") long before,
            @RequestParam(defaultValue="50") int limit
    ) {
        return jdbc.query(
                """
                SELECT id, source, title, message,
                       target_url, created_at, read_at
                FROM notifications
                WHERE portfolio_id = ? AND id < ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (rs, rowNum) -> {
                    Timestamp created = rs.getTimestamp("created_at");

                    return new NotificationView(
                            rs.getLong("id"),
                            rs.getString("source"),
                            rs.getString("title"),
                            rs.getString("message"),
                            rs.getString("target_url"),
                            created.toInstant(),
                            rs.getTimestamp("read_at") != null
                    );
                },
                portfolioId, before, Math.max(1,Math.min(limit,100))
        );
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(
            @PathVariable Long portfolioId
    ) {
        Long count = jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM notifications
                WHERE portfolio_id = ?
                  AND read_at IS NULL
                """,
                Long.class,
                portfolioId
        );

        return Map.of("count", count == null ? 0L : count);
    }

    @PatchMapping("/{notificationId}/unread")
    public Map<String,Boolean> markUnread(@PathVariable Long portfolioId,@PathVariable Long notificationId) {
        if(jdbc.update("UPDATE notifications SET read_at=NULL WHERE id=? AND portfolio_id=?",notificationId,portfolioId)==0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Notification not found");
        return Map.of("success",true);
    }

    @PatchMapping("/{notificationId}/read")
    public Map<String, Boolean> markRead(
            @PathVariable Long portfolioId,
            @PathVariable Long notificationId
    ) {
        int updated = jdbc.update(
                """
                UPDATE notifications
                SET read_at = COALESCE(read_at, NOW())
                WHERE id = ?
                  AND portfolio_id = ?
                """,
                notificationId,
                portfolioId
        );

        if (updated == 0) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Notification not found"
            );
        }

        return Map.of("success", true);
    }
}
