package com.rayen.backend.account;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

/**
 * Account and saved-CV endpoints. They all require a Supabase access token (SecurityConfig);
 * the user id always comes from the token's "sub" claim, never from the request.
 */
@RestController
@RequestMapping("/api")
public class AccountController {
    private final AccountService accounts;

    public AccountController(AccountService accounts) {
        this.accounts = accounts;
    }

    public record ProfileView(UUID id, String email, String fullName, String plan, String role, Instant createdAt) {}

    public record ProfileUpdate(@Size(max = 200) String fullName) {}

    public record CvRequest(@NotBlank @Size(max = 200) String title, @NotNull JsonNode content,
                            @Size(max = 15000) String jobDescription) {}

    public record CvSummary(UUID id, String title, Instant createdAt, Instant updatedAt,
                            Integer lastScore, Instant lastScoredAt) {}

    public record CvView(UUID id, String title, JsonNode content, String jobDescription,
                         Instant createdAt, Instant updatedAt) {}

    public record AnalysisRequest(@NotNull JsonNode result) {}

    public record AnalysisView(UUID id, UUID cvId, int overallScore, JsonNode categoryScores, JsonNode result,
                               Instant createdAt) {}

    @GetMapping("/me")
    public ProfileView me(@AuthenticationPrincipal Jwt jwt) {
        return view(accounts.profile(userId(jwt), signupName(jwt)), jwt);
    }

    @PatchMapping("/me")
    public ProfileView updateMe(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileUpdate update) {
        return view(accounts.rename(userId(jwt), update.fullName()), jwt);
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@AuthenticationPrincipal Jwt jwt) {
        accounts.deleteAccount(userId(jwt));
    }

    @GetMapping("/cvs")
    public List<CvSummary> listCvs(@AuthenticationPrincipal Jwt jwt) {
        UUID user = userId(jwt);
        Map<UUID, Analysis> latest = accounts.latestAnalyses(user);
        return accounts.listCvs(user).stream().map(cv -> {
            Analysis last = latest.get(cv.getId());
            return new CvSummary(cv.getId(), cv.getTitle(), cv.getCreatedAt(), cv.getUpdatedAt(),
                last == null ? null : last.getOverallScore(), last == null ? null : last.getCreatedAt());
        }).toList();
    }

    @PostMapping("/cvs")
    @ResponseStatus(HttpStatus.CREATED)
    public CvView createCv(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CvRequest request) {
        // Saving is often a new user's first request: create the profile with their sign-up name.
        accounts.profile(userId(jwt), signupName(jwt));
        return view(accounts.createCv(userId(jwt), request.title(), request.content(), request.jobDescription()));
    }

    @GetMapping("/cvs/{id}")
    public CvView getCv(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return view(accounts.cv(userId(jwt), id));
    }

    @PutMapping("/cvs/{id}")
    public CvView updateCv(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                           @Valid @RequestBody CvRequest request) {
        return view(accounts.updateCv(userId(jwt), id, request.title(), request.content(), request.jobDescription()));
    }

    @PostMapping("/cvs/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public CvView duplicateCv(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return view(accounts.duplicateCv(userId(jwt), id));
    }

    @DeleteMapping("/cvs/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCv(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        accounts.deleteCv(userId(jwt), id);
    }

    @GetMapping("/cvs/{id}/analyses")
    public List<AnalysisView> history(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return accounts.history(userId(jwt), id).stream().map(AccountController::view).toList();
    }

    @PostMapping("/cvs/{id}/analyses")
    @ResponseStatus(HttpStatus.CREATED)
    public AnalysisView saveAnalysis(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                     @Valid @RequestBody AnalysisRequest request) {
        return view(accounts.saveAnalysis(userId(jwt), id, request.result()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> failed(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode())
            .body(Map.of("message", exception.getReason() == null ? "Request failed." : exception.getReason()));
    }

    // Handle invalid bodies and ids locally so framework warnings cannot log submitted CV text.
    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidRequest() {
        return Map.of("message", "That request is not valid.");
    }

    private static UUID userId(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in again.");
        }
    }

    /** Supabase puts the name given at sign-up in user_metadata.full_name. */
    private static String signupName(Jwt jwt) {
        Object metadata = jwt.getClaims().get("user_metadata");
        return metadata instanceof Map<?, ?> map && map.get("full_name") instanceof String name ? name : null;
    }

    private static ProfileView view(Profile profile, Jwt jwt) {
        return new ProfileView(profile.getId(), jwt.getClaimAsString("email"), profile.getFullName(), profile.getPlan(),
            profile.getRole(), profile.getCreatedAt());
    }

    private static CvView view(Cv cv) {
        return new CvView(cv.getId(), cv.getTitle(), cv.getContent(), cv.getJobDescription(), cv.getCreatedAt(),
            cv.getUpdatedAt());
    }

    private static AnalysisView view(Analysis analysis) {
        return new AnalysisView(analysis.getId(), analysis.getCvId(), analysis.getOverallScore(),
            analysis.getCategoryScores(), analysis.getResult(), analysis.getCreatedAt());
    }
}
