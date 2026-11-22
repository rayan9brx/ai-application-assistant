package com.rayen.backend;

import jakarta.validation.Valid;
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

    public CvAiController(CvAiService ai) {
        this.ai = ai;
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
