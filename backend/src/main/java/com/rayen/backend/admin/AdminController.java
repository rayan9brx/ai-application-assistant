package com.rayen.backend.admin;

import com.rayen.backend.admin.AdminService.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;
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

    public AdminController(AdminService admin) {
        this.admin = admin;
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
