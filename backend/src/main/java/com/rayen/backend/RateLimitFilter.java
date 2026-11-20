package com.rayen.backend;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Fixed-window, per-IP request limits for the public CV endpoints, kept in memory.
 * Behind a reverse proxy, server.forward-headers-strategy=native makes getRemoteAddr()
 * the client's IP. For several server instances, move this to a shared store.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_MS = 10 * 60 * 1000;

    private final int aiLimit;
    private final int fileLimit;
    private final Map<String, long[]> windows = new ConcurrentHashMap<>();

    public RateLimitFilter(@Value("${app.rate-limit.ai-per-10-min:20}") int aiLimit,
                           @Value("${app.rate-limit.files-per-10-min:60}") int fileLimit) {
        this.aiLimit = aiLimit;
        this.fileLimit = fileLimit;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return bucket(request) == null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String bucket = bucket(request);
        int limit = "ai".equals(bucket) ? aiLimit : fileLimit;
        long now = System.currentTimeMillis();
        if (windows.size() > 10_000) windows.values().removeIf(window -> now - window[0] > WINDOW_MS);
        long[] window = windows.compute(bucket + ":" + request.getRemoteAddr(), (key, current) ->
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

    private static String bucket(HttpServletRequest request) {
        if (!"POST".equals(request.getMethod())) return null;
        String path = request.getRequestURI();
        if (path.equals("/api/cv/score") || path.equals("/api/cv/fix") || path.equals("/api/cv/tailor")) return "ai";
        if (path.equals("/api/cv/extract") || path.equals("/api/documents/export")) return "files";
        return null;
    }
}
