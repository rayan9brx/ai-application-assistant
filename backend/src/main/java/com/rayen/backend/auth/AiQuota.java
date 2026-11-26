package com.rayen.backend.auth;

import com.rayen.backend.admin.AdminAccess;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Monthly AI uses (rows in ai_usage this calendar month) against the Free plan's limit. Paid
 * plans and admins are unlimited. Keep app.limits.free-ai-uses-per-month equal to
 * aiUsesPerMonth in the frontend's plan-limits.ts.
 */
@Component
public class AiQuota {
    private final NamedParameterJdbcTemplate db;
    private final AdminAccess admins;
    private final ZoneId zone;
    private final int freeLimit;

    public AiQuota(NamedParameterJdbcTemplate db, AdminAccess admins,
                   @Value("${app.admin.timezone:Europe/Berlin}") String timezone,
                   @Value("${app.limits.free-ai-uses-per-month:20}") int freeLimit) {
        this.db = db;
        this.admins = admins;
        this.zone = ZoneId.of(timezone);
        this.freeLimit = freeLimit;
    }

    /** Throws 429 when a Free user has no AI uses left this month. */
    public void check(UUID user) {
        if (admins.isAdmin(user)) return;
        var p = new MapSqlParameterSource("user", user)
            .addValue("from", Timestamp.from(LocalDate.now(zone).withDayOfMonth(1).atStartOfDay(zone).toInstant()));
        String plan = db.query("select plan from public.profiles where id = :user", p,
            rs -> rs.next() ? rs.getString(1) : "free");
        if (!"free".equals(plan)) return;
        Long used = db.queryForObject(
            "select count(*) from public.ai_usage where user_id = :user and created_at >= :from", p, Long.class);
        if (used != null && used >= freeLimit) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "You’ve used all " + freeLimit + " AI uses of the Free plan this month. Upgrade to Pro for unlimited tailoring.");
        }
    }
}
