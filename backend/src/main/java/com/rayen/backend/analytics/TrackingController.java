package com.rayen.backend.analytics;

import com.rayen.backend.admin.AdminAccess;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.bind.annotation.*;

/**
 * POST /api/track: one page view from the Angular router. Public (guests browse the marketing
 * pages), sets no cookie, and always answers 204 so it can never break a page. A valid token is
 * read only to skip admins and to remember a signed-in user's country; a bad one is ignored.
 */
@RestController
public class TrackingController {
    private static final Logger log = LoggerFactory.getLogger(TrackingController.class);

    private final AnalyticsService analytics;
    private final AdminAccess admins;
    private final JwtDecoder jwtDecoder;

    public TrackingController(AnalyticsService analytics, AdminAccess admins, JwtDecoder jwtDecoder) {
        this.analytics = analytics;
        this.admins = admins;
        this.jwtDecoder = jwtDecoder;
    }

    public record PageView(@NotBlank @Size(max = 500) String path, @Size(max = 2000) String referrer) {}

    @PostMapping("/api/track")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void track(@Valid @RequestBody PageView view, HttpServletRequest request) {
        try {
            UUID user = userFromToken(request.getHeader(HttpHeaders.AUTHORIZATION));
            if (user != null && admins.isAdmin(user)) return;
            analytics.record(view.path(), view.referrer(), request.getRemoteAddr(),
                request.getHeader(HttpHeaders.USER_AGENT), request.getServerName(), user);
        } catch (RuntimeException exception) {
            log.warn("Page view not recorded: {}", exception.getClass().getSimpleName());
        }
    }

    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ignoreInvalid() {}

    private UUID userFromToken(String header) {
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) return null;
        try {
            return UUID.fromString(jwtDecoder.decode(header.substring(7).strip()).getSubject());
        } catch (JwtException | IllegalArgumentException | NullPointerException exception) {
            return null;
        }
    }
}
