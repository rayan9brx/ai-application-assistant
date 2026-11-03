package com.rayen.backend;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AnalysisController {
    // Validate all source fields without modifying their contents.
    public record AnalysisRequest(
        @NotBlank @Size(max = 30000) String cvText,
        @NotBlank @Size(max = 30000) String jobText,
        @NotBlank @Size(max = 150) String jobTitle,
        @NotBlank @Size(max = 150) String company,
        @NotBlank @Pattern(regexp = "English|German") String language,
        boolean includeLetter,
        @Size(max = 3000) String motivation
    ) {
        @AssertTrue(message = "Motivation is required when requesting a letter")
        public boolean isMotivationValid() {
            return !includeLetter || (motivation != null && !motivation.isBlank());
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AnalysisResponse(boolean demo, String notice, String cvDraft,
                                   String motivationLetterDraft, List<String> demoActions) {}

    // Return an unchanged CV and an optional editable template; no AI is involved.
    @PostMapping("/analyze")
    public AnalysisResponse analyze(@Valid @RequestBody AnalysisRequest request) {
        return new AnalysisResponse(true,
            "Demo preview — no AI analysis or tailoring occurred. The CV is unchanged; the letter is an editable template.",
            request.cvText(), request.includeLetter() ? letterTemplate(request) : null,
            request.includeLetter()
                ? List.of("Copied your CV exactly without tailoring or translation.", "Inserted your target details into a demo letter template.", "Included your motivation verbatim; no qualifications or motivations were invented.")
                : List.of("Copied your CV exactly without tailoring or translation.", "Validated application details; did not analyze the job description."));
    }

    // Handle invalid bodies locally so framework warnings cannot expose submitted text.
    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class})
    @ResponseStatus(org.springframework.http.HttpStatus.BAD_REQUEST)
    public java.util.Map<String, String> invalidRequest() {
        return java.util.Map.of("message", "Invalid application details. Check required fields, lengths, and language.");
    }

    // Keep missing personal details explicit and quote the supplied motivation verbatim.
    private String letterTemplate(AnalysisRequest request) {
        if ("German".equals(request.language())) {
            return "DEMO-VORLAGE — Keine KI-Analyse oder Anpassung durchgeführt.\n"
                + "Bitte alle Platzhalter ersetzen und den Text vor der Verwendung prüfen.\n\n"
                + "[Ihr Name]\n[Ihre Kontaktdaten]\n[Datum]\n\n"
                + request.company() + "\n[Adresse des Unternehmens]\n\n"
                + "Bewerbung als " + request.jobTitle() + "\n\n"
                + "Sehr geehrte/r [Ansprechperson],\n\n"
                + "[Einleitung zur Bewerbung ergänzen.]\n\n"
                + "Ihre angegebene Motivation (unverändert, nicht übersetzt):\n" + request.motivation()
                + "\n\n[Relevante Erfahrungen aus Ihrem Lebenslauf mit überprüfbaren Beispielen ergänzen.]"
                + "\n\n[Abschluss ergänzen.]\n\nMit freundlichen Grüßen\n[Ihr Name]";
        }
        return "DEMO TEMPLATE — No AI analysis or tailoring performed.\n"
            + "Replace every placeholder and review before use.\n\n"
            + "[Your name]\n[Your contact details]\n[Date]\n\n"
            + request.company() + "\n[Company address]\n\n"
            + "Application for " + request.jobTitle() + "\n\nDear [Contact name],\n\n"
            + "[Add your application introduction.]\n\n"
            + "Your supplied motivation (unchanged, not translated):\n" + request.motivation()
            + "\n\n[Add relevant experience from your CV with verifiable examples.]"
            + "\n\n[Add a closing paragraph.]\n\nKind regards,\n[Your name]";
    }
}
