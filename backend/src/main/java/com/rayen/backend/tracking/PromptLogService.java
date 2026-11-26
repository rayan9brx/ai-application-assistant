package com.rayen.backend.tracking;

import com.rayen.backend.admin.AdminService.Count;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** The smart prompt box's requests: stored truncated, shown to admins, deleted after 90 days. */
@Service
public class PromptLogService {
    private static final Logger log = LoggerFactory.getLogger(PromptLogService.class);
    public static final int MAX_TEXT = 300;
    public static final Set<String> ROUTES = Set.of("score", "tailor", "fix", "build", "other");
    private static final int RECENT = 20;

    private final JdbcTemplate jdbc;
    private final int retentionDays;

    public PromptLogService(JdbcTemplate jdbc, @Value("${app.prompts.retention-days:90}") int retentionDays) {
        this.jdbc = jdbc;
        this.retentionDays = retentionDays;
    }

    public record RecentPrompt(String text, String route, boolean signedIn, Instant createdAt) {}

    /** Counts per route and the latest prompts, over everything still kept. No user ids or emails. */
    public record PromptInsights(long total, List<Count> routes, List<RecentPrompt> recent) {}

    public void record(String text, String route, UUID userId) {
        String clean = text == null ? "" : text.strip();
        if (clean.length() > MAX_TEXT) clean = clean.substring(0, MAX_TEXT);
        String safeRoute = ROUTES.contains(route) ? route : "other";
        jdbc.update("insert into public.prompt_logs (text, route, user_id) values (?, ?, ?)", clean, safeRoute, userId);
    }

    public PromptInsights insights() {
        List<Count> routes = jdbc.query(
            "select route, count(*) as n from public.prompt_logs group by route order by n desc",
            (rs, i) -> new Count(rs.getString("route"), rs.getLong("n")));
        long total = routes.stream().mapToLong(Count::count).sum();
        List<RecentPrompt> recent = jdbc.query(
            "select text, route, user_id is not null as signed_in, created_at from public.prompt_logs "
                + "order by created_at desc limit " + RECENT,
            (rs, i) -> new RecentPrompt(rs.getString("text"), rs.getString("route"),
                rs.getBoolean("signed_in"), rs.getTimestamp("created_at").toInstant()));
        return new PromptInsights(total, routes, recent);
    }

    /** Daily: delete prompts past the retention period. */
    @Scheduled(cron = "0 45 3 * * *", zone = "${app.admin.timezone:Europe/Berlin}")
    public void cleanUp() {
        try {
            int deleted = jdbc.update("delete from public.prompt_logs where created_at < ?",
                Timestamp.from(Instant.now().minus(retentionDays, ChronoUnit.DAYS)));
            if (deleted > 0) log.info("Deleted {} prompts older than {} days.", deleted, retentionDays);
        } catch (RuntimeException exception) {
            log.warn("Prompt clean-up failed: {}", exception.getClass().getSimpleName());
        }
    }
}
