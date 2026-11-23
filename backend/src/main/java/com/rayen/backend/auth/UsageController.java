package com.rayen.backend.auth;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in user's usage for the app sidebar: saved CVs and AI requests this calendar month.
 * The plan limits these are shown against live in the frontend's plan-limits.ts.
 */
@RestController
public class UsageController {
    private final NamedParameterJdbcTemplate db;
    private final ZoneId zone;

    public UsageController(NamedParameterJdbcTemplate db,
                           @Value("${app.admin.timezone:Europe/Berlin}") String timezone) {
        this.db = db;
        this.zone = ZoneId.of(timezone);
    }

    public record Usage(long cvs, long aiUsesThisMonth) {}

    @GetMapping("/api/me/usage")
    public Usage usage(@AuthenticationPrincipal Jwt jwt) {
        UUID user = AccountController.userId(jwt);
        var p = new MapSqlParameterSource("user", user)
            .addValue("from", Timestamp.from(LocalDate.now(zone).withDayOfMonth(1).atStartOfDay(zone).toInstant()));
        Long cvs = db.queryForObject("select count(*) from public.cvs where user_id = :user", p, Long.class);
        Long ai = db.queryForObject(
            "select count(*) from public.ai_usage where user_id = :user and created_at >= :from", p, Long.class);
        return new Usage(cvs == null ? 0 : cvs, ai == null ? 0 : ai);
    }
}
