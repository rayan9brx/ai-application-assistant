package com.rayen.backend;

import java.io.IOException;
import java.io.Writer;
import java.util.Map;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/cv")
@CrossOrigin(origins = "http://localhost:4200")
public class CvExtractionController {
    static final long MAX_BYTES = 5L * 1024 * 1024;
    static final int MAX_TEXT = 30000;

    public record ExtractionResponse(String text) {}

    // Parse uploaded bytes in memory; neither file names nor MIME types prove PDF validity.
    @PostMapping(value = "/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ExtractionResponse extract(@RequestParam("file") MultipartFile file) {
        if (file.getSize() > MAX_BYTES) {
            throw new ExtractionException(HttpStatus.CONTENT_TOO_LARGE, "FILE_TOO_LARGE", "PDF must be 5 MB or smaller.");
        }
        if (file.isEmpty()) {
            throw invalidPdf();
        }
        try {
            byte[] bytes = file.getBytes();
            if (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-') {
                throw invalidPdf();
            }
            try (var document = Loader.loadPDF(bytes)) {
                if (document.isEncrypted()) {
                    throw protectedPdf();
                }
                var output = new LimitedTextWriter();
                new PDFTextStripper().writeText(document, output);
                String text = output.toString();
                if (text.codePoints().noneMatch(Character::isLetterOrDigit)) {
                    throw new ExtractionException(HttpStatus.UNPROCESSABLE_CONTENT, "NO_TEXT",
                        "No useful text was found. Scanned PDFs are not supported yet. Please paste your CV text instead.");
                }
                return new ExtractionResponse(text);
            }
        } catch (InvalidPasswordException exception) {
            throw protectedPdf();
        } catch (IOException | IllegalArgumentException exception) {
            throw invalidPdf();
        }
    }

    // Return safe messages without exposing parser errors or document contents.
    @ExceptionHandler(ExtractionException.class)
    public org.springframework.http.ResponseEntity<Map<String, String>> extractionError(ExtractionException exception) {
        return org.springframework.http.ResponseEntity.status(exception.status)
            .body(Map.of("code", exception.code, "message", exception.getMessage()));
    }

    // Give corrupt and non-PDF uploads the same actionable response.
    private ExtractionException invalidPdf() {
        return new ExtractionException(HttpStatus.BAD_REQUEST, "INVALID_PDF", "This file is not a readable PDF. Choose another PDF or paste your CV text.");
    }

    // Reject encryption even when a document can be opened with an empty password.
    private ExtractionException protectedPdf() {
        return new ExtractionException(HttpStatus.BAD_REQUEST, "PROTECTED_PDF", "Password-protected PDFs are not supported. Upload an unprotected copy or paste your CV text.");
    }

    static class ExtractionException extends RuntimeException {
        final HttpStatus status;
        final String code;

        // Keep the error payload independent of PDF parser details.
        ExtractionException(HttpStatus status, String code, String message) {
            super(message);
            this.status = status;
            this.code = code;
        }
    }

    private static class LimitedTextWriter extends Writer {
        private final StringBuilder text = new StringBuilder();

        // Stop extraction as soon as output exceeds the CV limit.
        @Override
        public void write(char[] buffer, int offset, int length) {
            if (text.length() + length > MAX_TEXT) {
                throw new ExtractionException(HttpStatus.UNPROCESSABLE_CONTENT, "TEXT_TOO_LONG", "Extracted CV text exceeds 30,000 characters. Paste a shorter CV instead.");
            }
            text.append(buffer, offset, length);
        }

        // This in-memory writer has no external buffer to flush.
        @Override public void flush() {}
        // PDFBox and the request own all resources; no file is created.
        @Override public void close() {}
        // Return only the extracted text, never parser diagnostics.
        @Override public String toString() { return text.toString(); }
    }
}
