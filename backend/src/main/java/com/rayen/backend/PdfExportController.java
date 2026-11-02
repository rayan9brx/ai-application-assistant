package com.rayen.backend;

import java.io.IOException;
import java.util.Map;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "http://localhost:4200")
public class PdfExportController {
    private final PdfExportService pdfExport;

    // Inject the shared in-memory PDF renderer.
    public PdfExportController(PdfExportService pdfExport) {
        this.pdfExport = pdfExport;
    }

    public record ExportRequest(
        @NotBlank @Pattern(regexp = "cv|motivationLetter") String documentType,
        @NotBlank @Size(max = 60000) String text
    ) {}

    // Export exactly the submitted editor text, using fixed safe download filenames.
    @PostMapping(value = "/export", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> export(@Valid @RequestBody ExportRequest request) throws IOException {
        if (request.text().codePoints().anyMatch(cp -> Character.isISOControl(cp) && cp != '\n' && cp != '\r' && cp != '\t' && cp != '\u0085')) {
            throw new PdfExportService.UnsupportedCharacterException();
        }
        String filename = request.documentType().equals("cv") ? "cv-demo.pdf" : "motivation-letter-demo.pdf";
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
            .cacheControl(CacheControl.noStore())
            .body(pdfExport.generate(request.text()));
    }

    // Suppress default validation logging, which can include rejected document text.
    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, String>> invalidRequest() {
        return error(HttpStatus.BAD_REQUEST, "Use document type cv or motivationLetter and nonempty text of at most 60,000 characters.");
    }

    // Explain unsupported symbols instead of silently deleting or replacing text.
    @ExceptionHandler(PdfExportService.UnsupportedCharacterException.class)
    public ResponseEntity<Map<String, String>> unsupportedCharacter() {
        return error(HttpStatus.UNPROCESSABLE_CONTENT, "This document contains characters the export font cannot display. English and German are supported; remove unsupported symbols or control characters and try again.");
    }

    // Keep internal renderer diagnostics and document text out of errors and logs.
    @ExceptionHandler(IOException.class)
    public ResponseEntity<Map<String, String>> exportFailed() {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "PDF export failed. Your draft is unchanged. Please try again.");
    }

    // Give every export failure a safe JSON payload, including blob-response clients.
    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(Map.of("message", message));
    }
}
