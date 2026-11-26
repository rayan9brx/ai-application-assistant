package com.rayen.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import com.rayen.backend.admin.AdminAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Fixed-window request limits for the CV endpoints and account writes, kept in memory. They are
 * counted per user (the JWT's "sub"; this filter runs after Spring Security), with the client IP
 * as a fallback. Behind a reverse proxy, server.forward-headers-strategy=native makes
 * getRemoteAddr() the client's IP. For several server instances, move this to a shared store.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_MS = 10 * 60 * 1000;

    private final int aiLimit;
    private final int fileLimit;
    private final int dataLimit;
    private final Map<String, long[]> windows = new ConcurrentHashMap<>();

    /** Null in unit tests: then nobody is treated as an admin. */
    private final AdminAccess admins;

    @Autowired
    public RateLimitFilter(@Value("${app.rate-limit.ai-per-10-min:20}") int aiLimit,
                           @Value("${app.rate-limit.files-per-10-min:60}") int fileLimit,
                           @Value("${app.rate-limit.data-per-10-min:300}") int dataLimit,
                           AdminAccess admins) {
        this.aiLimit = aiLimit;
        this.fileLimit = fileLimit;
        this.dataLimit = dataLimit;
        this.admins = admins;
    }

    public RateLimitFilter(int aiLimit, int fileLimit, int dataLimit) {
        this(aiLimit, fileLimit, dataLimit, null);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return bucket(request) == null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // Admins have no rate limits; the role is checked in the database for the verified JWT user.
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (admins != null && auth instanceof JwtAuthenticationToken && admins.isAdmin(auth)) {
            chain.doFilter(request, response);
            return;
        }
        String bucket = bucket(request);
        int limit = "ai".equals(bucket) ? aiLimit : "files".equals(bucket) ? fileLimit : dataLimit;
        long now = System.currentTimeMillis();
        if (windows.size() > 10_000) windows.values().removeIf(window -> now - window[0] > WINDOW_MS);
        long[] window = windows.compute(bucket + ":" + clientKey(request), (key, current) ->
            current == null || now - current[0] > WINDOW_MS ? new long[] {now, 1} : new long[] {current[0], current[1] + 1});
        if (window[1] > limit) {
            long retryAfter = Math.max(1, (WINDOW_MS - (now - window[0])) / 1000);
            response.setStatus(429);
            response.setHeader("Retry-After", Long.toString(retryAfter));
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Too many requests. Please wait a few minutes and try again.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    /** The signed-in user, so limits follow the account rather than a shared or changing IP. */
    private static String clientKey(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwt) return "user:" + jwt.getToken().getSubject();
        return "ip:" + request.getRemoteAddr();
    }

    private static String bucket(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getRequestURI();
        // Account writes (save CV, save analysis, rename, delete); reads stay unlimited.
        if (!"GET".equals(method) && !"HEAD".equals(method) && !"OPTIONS".equals(method)
            && SecurityConfig.isAccountPath(path)) return "data";
        if (!"POST".equals(method)) return null;
        if (path.equals("/api/cv/score") || path.equals("/api/cv/fix") || path.equals("/api/cv/tailor")) return "ai";
        if (path.equals("/api/cv/extract") || path.equals("/api/documents/export")) return "files";
        if (path.equals("/api/track") || path.equals("/api/prompts")) return "track";
        return null;
    }
}
