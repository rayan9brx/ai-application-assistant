package com.rayen.backend.admin;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Read-only queries for the admin dashboard, plus the audited CV view. User emails, sign-up and
 * last-login times come from Supabase's auth.users. CV content is only ever returned by
 * viewCv(), which writes an audit-log row first.
 */
@Service
public class AdminService {
    public static final int PAGE_SIZE = 25;
    private static final int TOP = 10;
    private static final int MAX_SERIES_DAYS = 730;

    private final NamedParameterJdbcTemplate db;
    private final ZoneId zone;
    private final JsonMapper json = JsonMapper.builder().build();

    public AdminService(NamedParameterJdbcTemplate db, @Value("${app.admin.timezone:Europe/Berlin}") String timezone) {
        this.db = db;
        this.zone = ZoneId.of(timezone);
    }

    public enum Range {
        TODAY(1), WEEK(7), MONTH(30), ALL(0);

        final int days;

        Range(int days) { this.days = days; }

        public static Range parse(String value) {
            return switch (value == null ? "" : value.toLowerCase(Locale.ROOT)) {
                case "today" -> TODAY;
                case "7d" -> WEEK;
                case "all" -> ALL;
                default -> MONTH;
            };
        }
    }

    public record Kpis(long visitors, long pageViews, long signups, long activeUsers, long cvsScored,
                       Double averageScore, long aiCalls, long inputTokens, long outputTokens, BigDecimal aiCostUsd) {}
    public record DayPoint(LocalDate day, long visitors, long signups) {}
    public record Count(String key, long count) {}
    public record Funnel(long visitors, long signups, long firstScored) {}
    public record Stats(String range, Instant from, Kpis kpis, List<DayPoint> series, List<Count> topPages,
                        List<Count> topCountries, List<Count> topReferrers, List<Count> devices, Funnel funnel) {}
    public record UserRow(UUID id, String email, Instant createdAt, Instant lastSignInAt, String country,
                          String plan, String role, long cvCount) {}
    public record CvRow(UUID id, String ownerEmail, String title, Instant createdAt, Integer lastScore) {}
    public record CvContent(UUID id, String ownerEmail, String title, JsonNode content, String jobDescription,
                            Instant createdAt) {}
    public record AuditRow(long id, Instant createdAt, String adminEmail, UUID cvId, String cvTitle,
                           String ownerEmail, String reason) {}
    public record Page<T>(List<T> items, long total, int page, int pageSize) {}

    public Stats stats(Range range) {
        LocalDate today = LocalDate.now(zone);
        Instant from = range == Range.ALL ? Instant.EPOCH
            : today.minusDays(range.days - 1L).atStartOfDay(zone).toInstant();
        var p = new MapSqlParameterSource("from", Timestamp.from(from)).addValue("tz", zone.getId());

        Map<String, Object> views = db.queryForMap("""
            select count(distinct visitor_hash) as visitors, count(*) as views
            from public.page_views where created_at >= :from""", p);
        long signups = count("select count(*) from auth.users where created_at >= :from", p);
        long active = count("""
            select count(*) from (
                select id from auth.users where last_sign_in_at >= :from
                union select user_id from public.analyses where created_at >= :from
                union select user_id from public.ai_usage where created_at >= :from and user_id is not null
            ) active""", p);
        Map<String, Object> scores = db.queryForMap(
            "select count(*) as n, avg(overall_score) as average from public.analyses where created_at >= :from", p);
        Map<String, Object> ai = db.queryForMap("""
            select count(*) as calls, coalesce(sum(input_tokens), 0) as input, coalesce(sum(output_tokens), 0) as output,
                   coalesce(sum(cost_usd), 0) as cost
            from public.ai_usage where created_at >= :from""", p);
        Number average = (Number) scores.get("average");
        var kpis = new Kpis(num(views.get("visitors")), num(views.get("views")), signups, active, num(scores.get("n")),
            average == null ? null : Math.round(average.doubleValue() * 10) / 10.0,
            num(ai.get("calls")), num(ai.get("input")), num(ai.get("output")),
            ((BigDecimal) ai.get("cost")).setScale(2, java.math.RoundingMode.HALF_UP));

        long firstScored = count("""
            select count(*) from (select min(created_at) as first from public.analyses group by user_id) f
            where f.first >= :from""", p);

        return new Stats(range.name().toLowerCase(Locale.ROOT), from, kpis, series(range, today, p),
            counts("select path as key, count(*) as n from public.page_views where created_at >= :from group by path", p),
            counts("""
                select coalesce(country, '') as key, count(distinct visitor_hash) as n
                from public.page_views where created_at >= :from group by country""", p),
            counts("""
                select referrer_domain as key, count(distinct visitor_hash) as n from public.page_views
                where created_at >= :from and referrer_domain is not null group by referrer_domain""", p),
            counts("""
                select device_type as key, count(distinct visitor_hash) as n
                from public.page_views where created_at >= :from group by device_type""", p),
            new Funnel(kpis.visitors(), signups, firstScored));
    }

    /** Visitors and sign-ups per day in the admin time zone, with zero days filled in. */
    private List<DayPoint> series(Range range, LocalDate today, MapSqlParameterSource p) {
        Map<LocalDate, Long> visitors = byDay("""
            select (created_at at time zone cast(:tz as text))::date as day, count(distinct visitor_hash) as n
            from public.page_views where created_at >= :from group by 1""", p);
        Map<LocalDate, Long> signups = byDay("""
            select (created_at at time zone cast(:tz as text))::date as day, count(*) as n
            from auth.users where created_at >= :from group by 1""", p);
        LocalDate start;
        if (range == Range.ALL) {
            start = visitors.keySet().stream().min(LocalDate::compareTo).orElse(today);
            for (LocalDate day : signups.keySet()) if (day.isBefore(start)) start = day;
            if (ChronoUnit.DAYS.between(start, today) > MAX_SERIES_DAYS) start = today.minusDays(MAX_SERIES_DAYS);
        } else {
            start = today.minusDays(range.days - 1L);
        }
        List<DayPoint> points = new ArrayList<>();
        for (LocalDate day = start; !day.isAfter(today); day = day.plusDays(1)) {
            points.add(new DayPoint(day, visitors.getOrDefault(day, 0L), signups.getOrDefault(day, 0L)));
        }
        return points;
    }

    public Page<UserRow> users(String query, int page) {
        String q = clean(query);
        var p = paging(page).addValue("pattern", like(q));
        String where = q.isEmpty() ? "" : "where u.email ilike :pattern";
        long total = count("select count(*) from auth.users u " + where, p);
        List<UserRow> rows = db.query("""
            select u.id, u.email, u.created_at, u.last_sign_in_at, pr.country,
                   coalesce(pr.plan, 'free') as plan, coalesce(pr.role, 'user') as role,
                   (select count(*) from public.cvs c where c.user_id = u.id) as cv_count
            from auth.users u left join public.profiles pr on pr.id = u.id
            """ + where + " order by u.created_at desc limit :limit offset :offset", p,
            (rs, i) -> new UserRow(rs.getObject("id", UUID.class), rs.getString("email"), instant(rs, "created_at"),
                instant(rs, "last_sign_in_at"), rs.getString("country"), rs.getString("plan"), rs.getString("role"),
                rs.getLong("cv_count")));
        return new Page<>(rows, total, Math.max(page, 0), PAGE_SIZE);
    }

    /** Metadata only: no CV content leaves this method. */
    public Page<CvRow> cvs(String query, int page) {
        String q = clean(query);
        var p = paging(page).addValue("pattern", like(q));
        String where = q.isEmpty() ? "" : "where u.email ilike :pattern or c.title ilike :pattern";
        long total = count("select count(*) from public.cvs c join auth.users u on u.id = c.user_id " + where, p);
        List<CvRow> rows = db.query("""
            select c.id, u.email, c.title, c.created_at,
                   (select a.overall_score from public.analyses a where a.cv_id = c.id
                    order by a.created_at desc limit 1) as last_score
            from public.cvs c join auth.users u on u.id = c.user_id
            """ + where + " order by c.created_at desc limit :limit offset :offset", p,
            (rs, i) -> new CvRow(rs.getObject("id", UUID.class), rs.getString("email"), rs.getString("title"),
                instant(rs, "created_at"), (Integer) rs.getObject("last_score")));
        return new Page<>(rows, total, Math.max(page, 0), PAGE_SIZE);
    }

    /** Logs the view (admin, CV, reason) and only then returns the content, in one transaction. */
    @Transactional
    public CvContent viewCv(UUID adminId, UUID cvId, String reason) {
        String why = reason == null ? "" : reason.strip();
        if (why.length() < 3 || why.length() > 300) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Give a reason of 3 to 300 characters.");
        }
        var p = new MapSqlParameterSource("cv", cvId).addValue("admin", adminId).addValue("reason", why);
        List<CvContent> found = db.query("""
            select c.id, u.email, c.title, c.content::text as content, c.job_description, c.created_at
            from public.cvs c join auth.users u on u.id = c.user_id where c.id = :cv""", p,
            (rs, i) -> new CvContent(rs.getObject("id", UUID.class), rs.getString("email"), rs.getString("title"),
                json.readTree(rs.getString("content")), rs.getString("job_description"), instant(rs, "created_at")));
        if (found.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "CV not found.");
        db.update("insert into public.admin_audit_log (admin_id, cv_id, reason) values (:admin, :cv, :reason)", p);
        return found.get(0);
    }

    public Page<AuditRow> audit(int page) {
        var p = paging(page);
        long total = count("select count(*) from public.admin_audit_log", p);
        List<AuditRow> rows = db.query("""
            select l.id, l.created_at, a.email as admin_email, l.cv_id, c.title, o.email as owner_email, l.reason
            from public.admin_audit_log l
            left join auth.users a on a.id = l.admin_id
            left join public.cvs c on c.id = l.cv_id
            left join auth.users o on o.id = c.user_id
            order by l.created_at desc limit :limit offset :offset""", p,
            (rs, i) -> new AuditRow(rs.getLong("id"), instant(rs, "created_at"), rs.getString("admin_email"),
                rs.getObject("cv_id", UUID.class), rs.getString("title"), rs.getString("owner_email"),
                rs.getString("reason")));
        return new Page<>(rows, total, Math.max(page, 0), PAGE_SIZE);
    }

    private long count(String sql, MapSqlParameterSource p) {
        Long value = db.queryForObject(sql, p, Long.class);
        return value == null ? 0 : value;
    }

    private List<Count> counts(String sql, MapSqlParameterSource p) {
        return db.query(sql + " order by n desc limit " + TOP, p, (rs, i) -> new Count(rs.getString("key"), rs.getLong("n")));
    }

    private Map<LocalDate, Long> byDay(String sql, MapSqlParameterSource p) {
        Map<LocalDate, Long> result = new HashMap<>();
        db.query(sql, p, rs -> {
            result.put(rs.getObject("day", LocalDate.class), rs.getLong("n"));
        });
        return result;
    }

    private static MapSqlParameterSource paging(int page) {
        int safe = Math.min(Math.max(page, 0), 10_000);
        return new MapSqlParameterSource("limit", PAGE_SIZE).addValue("offset", safe * PAGE_SIZE);
    }

    private static String clean(String query) {
        if (query == null) return "";
        String q = query.strip();
        return q.length() > 100 ? q.substring(0, 100) : q;
    }

    /** An ILIKE pattern that treats % and _ in the search text literally. */
    private static String like(String q) {
        return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private static long num(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
