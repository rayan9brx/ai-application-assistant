package com.rayen.backend.admin;

import com.rayen.backend.admin.AdminService.*;
import com.rayen.backend.tracking.AnalyticsService;
import com.rayen.backend.tracking.PromptLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * /api/admin/**. SecurityConfig lets a request through only when AdminAccess confirms the JWT
 * user has role 'admin' in the database (401 without a token, 403 for everyone else).
 * There is deliberately no endpoint that exports CVs in bulk.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminService admin;
    private final AnalyticsService analytics;
    private final PromptLogService prompts;

    public AdminController(AdminService admin, AnalyticsService analytics, PromptLogService prompts) {
        this.admin = admin;
        this.analytics = analytics;
        this.prompts = prompts;
    }

    public record ViewRequest(@NotBlank @Size(min = 3, max = 300) String reason) {}

    @GetMapping("/stats")
    public Stats stats(@RequestParam(defaultValue = "30d") String range) {
        return admin.stats(Range.parse(range));
    }

    @GetMapping("/onboarding")
    public OnboardingStats onboarding() {
        return admin.onboarding();
    }

    @GetMapping("/users")
    public AdminService.Page<UserRow> users(@RequestParam(defaultValue = "") String q,
                                            @RequestParam(defaultValue = "0") int page) {
        return admin.users(q, page);
    }

    @GetMapping("/cvs")
    public AdminService.Page<CvRow> cvs(@RequestParam(defaultValue = "") String q,
                                        @RequestParam(defaultValue = "0") int page) {
        return admin.cvs(q, page);
    }

    /** POST, not GET, so the reason is in the body and the view is never cached or prefetched. */
    @PostMapping("/cvs/{id}/view")
    public CvContent viewCv(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                            @Valid @RequestBody ViewRequest request) {
        return admin.viewCv(UUID.fromString(jwt.getSubject()), id, request.reason());
    }

    public record Deleted(int deleted) {}

    /** This browser's own visits (same IP and user agent), as far back as the hashes can be rebuilt. */
    @DeleteMapping("/page-views/mine")
    public Deleted deleteMyPageViews(@AuthenticationPrincipal Jwt jwt, HttpServletRequest request) {
        int deleted = analytics.deleteVisitor(request.getRemoteAddr(), request.getHeader(HttpHeaders.USER_AGENT));
        admin.logAction(UUID.fromString(jwt.getSubject()), "Deleted " + deleted + " page views of own browser");
        return new Deleted(deleted);
    }

    /** All page views from `from` to `to` (yyyy-mm-dd, inclusive), for clearing test data. */
    @DeleteMapping("/page-views")
    public Deleted deletePageViews(@AuthenticationPrincipal Jwt jwt, @RequestParam String from, @RequestParam String to) {
        LocalDate start;
        LocalDate end;
        try {
            start = LocalDate.parse(from);
            end = LocalDate.parse(to);
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Give both dates as yyyy-mm-dd.");
        }
        if (end.isBefore(start)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The end date is before the start date.");
        if (ChronoUnit.DAYS.between(start, end) > 366) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pick a range of at most one year.");
        }
        int deleted = analytics.deleteBetween(start, end);
        admin.logAction(UUID.fromString(jwt.getSubject()), "Deleted " + deleted + " page views from " + start + " to " + end);
        return new Deleted(deleted);
    }

    /** "What users ask for": smart-prompt requests per route and the 20 latest. */
    @GetMapping("/prompts")
    public PromptLogService.PromptInsights prompts() {
        return prompts.insights();
    }

    @GetMapping("/audit")
    public AdminService.Page<AuditRow> audit(@RequestParam(defaultValue = "0") int page) {
        return admin.audit(page);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> failed(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode())
            .body(Map.of("message", exception.getReason() == null ? "Request failed." : exception.getReason()));
    }

    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidRequest() {
        return Map.of("message", "Give a reason of 3 to 300 characters.");
    }
}
