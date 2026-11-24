package com.rayen.backend.tracking;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Cookieless page-view analytics. For each view it stores the path, GeoIP country/city, the
 * referring site, mobile or desktop, and an anonymous visitor hash: sha256(daily salt + IP + user
 * agent). The salt is random, lives one day and is then deleted, so hashes can't be reversed or
 * linked across days. The IP itself is never written anywhere.
 */
@Service
public class AnalyticsService {
    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);
    private static final Pattern BOT = Pattern.compile(
        "bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|java/|okhttp|go-http",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern MOBILE = Pattern.compile("Mobi|Android|iPhone|iPad|iPod", Pattern.CASE_INSENSITIVE);
    /** Only plain app paths; anything else (tokens, odd encodings) is dropped. */
    private static final Pattern SAFE_PATH = Pattern.compile("/[A-Za-z0-9/_.~-]{0,199}");

    private final JdbcTemplate jdbc;
    private final GeoIp geo;
    private final ZoneId zone;
    private final int retentionDays;
    private final SecureRandom random = new SecureRandom();
    private LocalDate saltDay;
    private byte[] salt;

    public AnalyticsService(JdbcTemplate jdbc, GeoIp geo,
                            @Value("${app.admin.timezone:Europe/Berlin}") String timezone,
                            @Value("${app.analytics.retention-days:365}") int retentionDays) {
        this.jdbc = jdbc;
        this.geo = geo;
        this.zone = ZoneId.of(timezone);
        this.retentionDays = retentionDays;
    }

    /** Records one view; `userId` is set for signed-in visitors only to remember their country. */
    public void record(String path, String referrer, String ip, String userAgent, String ownHost, UUID userId) {
        String cleanPath = cleanPath(path);
        if (cleanPath == null || userAgent == null || userAgent.isBlank() || BOT.matcher(userAgent).find()) return;
        GeoIp.Location location = geo.lookup(ip);
        String device = MOBILE.matcher(userAgent).find() ? "mobile" : "desktop";
        String hash = visitorHash(ip, userAgent);
        jdbc.update("""
            insert into public.page_views (path, country, city, referrer_domain, device_type, visitor_hash)
            values (?, ?, ?, ?, ?, ?)""",
            cleanPath, location.country(), location.city(), referrerDomain(referrer, ownHost), device, hash);
        if (userId != null && location.country() != null) {
            jdbc.update("update public.profiles set country = ? where id = ? and country is distinct from ?",
                location.country(), userId, location.country());
        }
    }

    /** Daily: delete page views past the retention period and salts older than yesterday. */
    @Scheduled(cron = "0 30 3 * * *", zone = "${app.admin.timezone:Europe/Berlin}")
    public void cleanUp() {
        try {
            int deleted = jdbc.update("delete from public.page_views where created_at < ?",
                java.sql.Timestamp.from(Instant.now().minus(retentionDays, ChronoUnit.DAYS)));
            jdbc.update("delete from public.visitor_salts where day < ?", LocalDate.now(zone).minusDays(1));
            if (deleted > 0) log.info("Deleted {} page views older than {} days.", deleted, retentionDays);
        } catch (RuntimeException exception) {
            log.warn("Analytics clean-up failed: {}", exception.getClass().getSimpleName());
        }
    }

    /**
     * Deletes the views of the visitor with this IP and user agent. Only today's and yesterday's
     * hashes can be rebuilt (older salts are deleted by design), so older test visits need a date range.
     */
    public int deleteVisitor(String ip, String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return 0;
        todaysSalt();
        List<byte[]> salts = jdbc.queryForList(
            "select salt from public.visitor_salts where day >= ?", byte[].class, LocalDate.now(zone).minusDays(1));
        int deleted = 0;
        for (byte[] daySalt : salts) {
            deleted += jdbc.update("delete from public.page_views where visitor_hash = ?", hash(daySalt, ip, userAgent));
        }
        return deleted;
    }

    /** Deletes every view from `from` to `to`, both inclusive, as days in the admin time zone. */
    public int deleteBetween(LocalDate from, LocalDate to) {
        return jdbc.update("delete from public.page_views where created_at >= ? and created_at < ?",
            java.sql.Timestamp.from(from.atStartOfDay(zone).toInstant()),
            java.sql.Timestamp.from(to.plusDays(1).atStartOfDay(zone).toInstant()));
    }

    private String visitorHash(String ip, String userAgent) {
        return hash(todaysSalt(), ip, userAgent);
    }

    private static String hash(byte[] daySalt, String ip, String userAgent) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            sha.update(daySalt);
            sha.update((ip + "\n" + userAgent).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(sha.digest());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    /** Kept in the database (not memory) so a restart doesn't split one day's visitors in two. */
    private synchronized byte[] todaysSalt() {
        LocalDate today = LocalDate.now(zone);
        if (today.equals(saltDay)) return salt;
        byte[] fresh = new byte[32];
        random.nextBytes(fresh);
        jdbc.update("insert into public.visitor_salts (day, salt) values (?, ?) on conflict (day) do nothing", today, fresh);
        List<byte[]> stored = jdbc.queryForList("select salt from public.visitor_salts where day = ?", byte[].class, today);
        jdbc.update("delete from public.visitor_salts where day < ?", today.minusDays(1));
        salt = stored.isEmpty() ? fresh : stored.get(0);
        saltDay = today;
        return salt;
    }

    static String cleanPath(String path) {
        if (path == null) return null;
        int cut = path.indexOf('?');
        if (cut >= 0) path = path.substring(0, cut);
        cut = path.indexOf('#');
        if (cut >= 0) path = path.substring(0, cut);
        if (path.length() > 1 && path.endsWith("/")) path = path.substring(0, path.length() - 1);
        return SAFE_PATH.matcher(path).matches() ? path : null;
    }

    /** "news.ycombinator.com" from a referrer URL; null for our own site, typed URLs and junk. */
    static String referrerDomain(String referrer, String ownHost) {
        if (referrer == null || referrer.isBlank()) return null;
        try {
            String host = URI.create(referrer.strip()).getHost();
            if (host == null) return null;
            host = stripWww(host.toLowerCase(Locale.ROOT));
            if (ownHost != null && host.equals(stripWww(ownHost.toLowerCase(Locale.ROOT).replaceAll(":\\d+$", "")))) return null;
            return host.length() > 200 ? host.substring(0, 200) : host;
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private static String stripWww(String host) {
        return host.startsWith("www.") ? host.substring(4) : host;
    }
}
