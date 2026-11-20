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
public class CvExtractionController {
    static final long MAX_BYTES = 5L * 1024 * 1024;
    static final int MAX_TEXT = 30000;

    public record ExtractionResponse(String text) {}

    // Parse uploaded bytes in memory and never store them; neither file names nor MIME types
    // prove validity, so the format is decided from the file's first bytes.
    @PostMapping(value = "/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ExtractionResponse extract(@RequestParam("file") MultipartFile file) {
        if (file.getSize() > MAX_BYTES) {
            throw new ExtractionException(HttpStatus.CONTENT_TOO_LARGE, "FILE_TOO_LARGE", "Your file must be 5 MB or smaller.");
        }
        if (file.isEmpty()) {
            throw invalidPdf();
        }
        try {
            byte[] bytes = file.getBytes();
            if (DocxText.looksLikeZip(bytes)) {
                return new ExtractionResponse(usable(docxText(bytes)));
            }
            if (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-') {
                throw invalidPdf();
            }
            try (var document = Loader.loadPDF(bytes)) {
                if (document.isEncrypted()) {
                    throw protectedPdf();
                }
                var output = new LimitedTextWriter();
                new PDFTextStripper().writeText(document, output);
                return new ExtractionResponse(usable(output.toString()));
            }
        } catch (InvalidPasswordException exception) {
            throw protectedPdf();
        } catch (IOException | IllegalArgumentException exception) {
            throw invalidPdf();
        }
    }

    // Scanned (image-only) documents have no text layer to extract.
    private String usable(String text) {
        if (text.codePoints().noneMatch(Character::isLetterOrDigit)) {
            throw new ExtractionException(HttpStatus.UNPROCESSABLE_CONTENT, "NO_TEXT",
                "No readable text was found. It looks like a scanned image, which we can't read yet. Please paste your CV text instead.");
        }
        return normalize(text);
    }

    // PDFBox uses the platform line separator and pads lines with spaces; return plain \n lines.
    static String normalize(String text) {
        return text.lines().map(String::stripTrailing).collect(java.util.stream.Collectors.joining("\n")).strip();
    }

    private String docxText(byte[] bytes) {
        try {
            return DocxText.extract(bytes, MAX_TEXT);
        } catch (DocxText.TooLongException exception) {
            throw tooLong();
        } catch (IOException | RuntimeException exception) {
            throw new ExtractionException(HttpStatus.BAD_REQUEST, "INVALID_DOCX",
                "This Word file couldn't be read. Save it again as .docx or PDF, or paste your CV text.");
        }
    }

    private static ExtractionException tooLong() {
        return new ExtractionException(HttpStatus.UNPROCESSABLE_CONTENT, "TEXT_TOO_LONG", "Extracted CV text exceeds 30,000 characters. Paste a shorter CV instead.");
    }

    // Return safe messages without exposing parser errors or document contents.
    @ExceptionHandler(ExtractionException.class)
    public org.springframework.http.ResponseEntity<Map<String, String>> extractionError(ExtractionException exception) {
        return org.springframework.http.ResponseEntity.status(exception.status)
            .body(Map.of("code", exception.code, "message", exception.getMessage()));
    }

    // Give corrupt and non-PDF uploads the same actionable response.
    private ExtractionException invalidPdf() {
        return new ExtractionException(HttpStatus.BAD_REQUEST, "INVALID_PDF", "This file isn't a readable PDF or Word (.docx) document. Choose another file or paste your CV text.");
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
                throw tooLong();
            }
            text.append(buffer, offset, length);
        }

        @Override public void flush() {}
        @Override public void close() {}
        @Override public String toString() { return text.toString(); }
    }
}
