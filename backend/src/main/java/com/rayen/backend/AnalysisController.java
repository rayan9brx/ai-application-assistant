package com.rayen.backend;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:4200")
public class AnalysisController {

    // Define the required inputs and their maximum lengths.
    public record AnalysisRequest(
        @NotBlank @Size(max = 30000) String cvText,
        @NotBlank @Size(max = 30000) String jobText
    ) {}

    // Define the response returned to Angular.
    public record AnalysisResponse(String message) {}

    // Confirm that both texts reached the backend; no AI runs yet.
    @PostMapping("/analyze")
    public AnalysisResponse analyze(
        @Valid @RequestBody AnalysisRequest request
    ) {
        return new AnalysisResponse(
            "Backend received your CV and job description. "
            + "AI analysis is not connected yet."
        );
    }
}