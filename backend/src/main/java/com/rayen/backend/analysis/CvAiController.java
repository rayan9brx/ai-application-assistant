package com.rayen.backend.analysis;

import com.rayen.backend.auth.AiQuota;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * AI endpoints of the Upload → Score → Fix → Download flow. They need a signed-in user
 * (SecurityConfig), are rate limited per user (RateLimitFilter), and keep nothing themselves:
 * CV text exists only for the request; the frontend saves scores through the CV endpoints.
 */
@RestController
@RequestMapping("/api/cv")
public class CvAiController {
    static final int MAX_CV = 30000;
    static final int MAX_JOB = 15000;

    private final CvAiService ai;
    private final AiQuota quota;
    private final JobAdFetcher jobAds;

    public CvAiController(CvAiService ai, AiQuota quota, JobAdFetcher jobAds) {
        this.ai = ai;
        this.quota = quota;
        this.jobAds = jobAds;
    }

    public record ScoreRequest(@NotBlank @Size(max = MAX_CV) String cvText, @Size(max = MAX_JOB) String jobDescription) {}

    public record IssueInput(@NotBlank @Size(max = 200) String section, @NotBlank @Size(max = 1000) String problem,
                             @NotBlank @Size(max = 1500) String suggestion) {}

    public record FixRequest(@NotBlank @Size(max = MAX_CV) String cvText, @Size(max = MAX_JOB) String jobDescription,
                             @NotNull @Valid IssueInput issue) {}

    public record TailorRequest(@NotBlank @Size(max = MAX_CV) String cvText, @NotBlank @Size(max = MAX_JOB) String jobDescription) {}

    @PostMapping("/score")
    public CvAnalysis.Score score(@Valid @RequestBody ScoreRequest request) {
        return ai.score(request.cvText(), request.jobDescription());
    }

    @PostMapping("/fix")
    public CvAnalysis.Fix fix(@Valid @RequestBody FixRequest request) {
        var issue = request.issue();
        return ai.fix(request.cvText(), new CvAnalysis.Issue(issue.section(), issue.problem(), issue.suggestion(), "medium"),
            request.jobDescription());
    }

    @PostMapping("/tailor")
    public CvAnalysis.Tailoring tailor(@Valid @RequestBody TailorRequest request) {
        return ai.tailor(request.cvText(), request.jobDescription());
    }

    public record TailorJobRequest(@NotBlank @Size(max = MAX_CV) String cvText,
                                   @NotBlank @Size(min = 50, max = MAX_JOB) String jobDescription) {}

    public record JobAdRequest(@NotBlank @Size(max = 2000) String url) {}

    /** The /tailor page: one AI use. Free users are checked against their monthly limit first. */
    @PostMapping("/tailor-job")
    public CvAnalysis.JobTailoring tailorJob(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TailorJobRequest request) {
        quota.check(UUID.fromString(jwt.getSubject()));
        return ai.tailorJob(request.cvText(), request.jobDescription());
    }

    /** The text of a job ad behind a link; 422 with "paste it instead" when the page can't be read. */
    @PostMapping("/job-ad")
    public JobAdFetcher.JobAd jobAd(@Valid @RequestBody JobAdRequest request) {
        return jobAds.fetch(request.url());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> refused(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode())
            .body(Map.of("message", exception.getReason() == null ? "Request failed." : exception.getReason()));
    }

    @ExceptionHandler(ClaudeClient.AiException.class)
    public ResponseEntity<Map<String, String>> aiFailed(ClaudeClient.AiException exception) {
        return ResponseEntity.status(exception.status).body(Map.of("message", exception.getMessage()));
    }

    // Handle invalid bodies locally so framework warnings cannot log submitted CV text.
    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidRequest() {
        return Map.of("message", "Add your CV text (up to 30,000 characters) and keep the job description under 15,000 characters.");
    }
}
