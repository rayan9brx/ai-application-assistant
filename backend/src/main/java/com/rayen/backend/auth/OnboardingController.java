package com.rayen.backend.auth;

import com.rayen.backend.auth.OnboardingRepository.Answers;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * The onboarding flow's answers (also edited as "Job preferences" in Settings). The user id
 * always comes from the token, never from the request.
 */
@RestController
@RequestMapping("/api/me/onboarding")
public class OnboardingController {
    /** Allowed option keys per single-choice question; the frontend's onboarding-options.ts mirrors them. */
    static final Set<String> CHALLENGES = Set.of("cv_quality", "ats", "tailor", "job_search");
    static final Set<String> FOUND_JOBS = Set.of("one", "many", "looking", "not_applying");
    static final Set<String> SEARCH_STATUSES = Set.of("active", "open", "not_looking");
    static final Set<String> EXPERIENCE_LEVELS = Set.of("student", "entry", "mid", "senior", "lead");
    static final Set<String> ROLES = Set.of("engineering", "design", "product", "data_ai", "marketing", "sales",
        "finance", "hr", "operations", "support", "other");
    static final Set<String> WORK_MODES = Set.of("onsite", "hybrid", "remote");
    static final Set<String> MIN_SALARIES = Set.of("any", "40k", "50k", "60k", "80k", "100k");
    static final int MAX_LOCATIONS = 20;
    static final int MAX_LOCATION_CHARS = 60;

    private final AccountService accounts;
    private final OnboardingRepository onboarding;

    public OnboardingController(AccountService accounts, OnboardingRepository onboarding) {
        this.accounts = accounts;
        this.onboarding = onboarding;
    }

    /** done: finished or skipped, so the flow is never shown again. */
    public record OnboardingView(Answers answers, boolean completed, Integer skippedAtStep, boolean done) {}

    /**
     * status: "progress" after a step, "completed" after the last one, "skipped" with the step the
     * user skipped on, or "edit" from Settings (keeps the flow's status as it is).
     */
    public record OnboardingRequest(@NotNull @Valid Answers answers, @NotNull String status,
                                    @Min(1) @Max(8) Integer step) {}

    @GetMapping
    public OnboardingView get(@AuthenticationPrincipal Jwt jwt) {
        return view(onboarding.find(AccountController.userId(jwt)));
    }

    @PutMapping
    public OnboardingView save(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody OnboardingRequest request) {
        UUID user = AccountController.userId(jwt);
        Answers answers = checked(request.answers());
        boolean completed = switch (request.status()) {
            case "completed" -> true;
            case "progress", "skipped", "edit" -> false;
            default -> throw bad();
        };
        Integer skipped = null;
        if (request.status().equals("skipped")) {
            if (request.step() == null) throw bad();
            skipped = request.step();
        }
        // The row references the profile, which a brand-new user may not have yet.
        accounts.profile(user, AccountController.signupName(jwt));
        onboarding.save(user, answers, completed, skipped);
        return view(onboarding.find(user));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> failed(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode())
            .body(Map.of("message", exception.getReason() == null ? "Request failed." : exception.getReason()));
    }

    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidRequest() {
        return Map.of("message", "Those answers are not valid.");
    }

    private static OnboardingView view(java.util.Optional<OnboardingRepository.Row> row) {
        return row.map(r -> new OnboardingView(r.answers(), r.completed(), r.skippedAtStep(),
                r.completed() || r.skippedAtStep() != null))
            .orElseGet(() -> new OnboardingView(
                new Answers(null, null, null, null, List.of(), List.of(), List.of(), null), false, null, false));
    }

    private static Answers checked(Answers a) {
        return new Answers(one(a.challenge(), CHALLENGES), one(a.foundJobs(), FOUND_JOBS),
            one(a.searchStatus(), SEARCH_STATUSES), one(a.experienceLevel(), EXPERIENCE_LEVELS),
            many(a.roles(), ROLES), many(a.workModes(), WORK_MODES), locations(a.locations()),
            one(a.minSalary(), MIN_SALARIES));
    }

    private static String one(String value, Set<String> allowed) {
        if (value == null) return null;
        if (!allowed.contains(value)) throw bad();
        return value;
    }

    private static List<String> many(List<String> values, Set<String> allowed) {
        if (values == null) return List.of();
        if (!allowed.containsAll(values)) throw bad();
        return List.copyOf(new LinkedHashSet<>(values));
    }

    /** Free text: trimmed, blanks and case-insensitive duplicates dropped. */
    private static List<String> locations(List<String> values) {
        if (values == null) return List.of();
        Map<String, String> unique = new java.util.LinkedHashMap<>();
        for (String value : values) {
            if (value == null || value.isBlank()) continue;
            String clean = value.strip();
            if (clean.length() > MAX_LOCATION_CHARS) throw bad();
            unique.putIfAbsent(clean.toLowerCase(java.util.Locale.ROOT), clean);
        }
        if (unique.size() > MAX_LOCATIONS) throw bad();
        return List.copyOf(unique.values());
    }

    private static ResponseStatusException bad() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Those answers are not valid.");
    }
}
