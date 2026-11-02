package com.rayen.backend;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.font.*;
import org.apache.pdfbox.pdmodel.encryption.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CvExtractionControllerTests {
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new CvExtractionController())
        .setControllerAdvice(new UploadExceptionHandler()).build();

    // Generate actual PDF bytes so tests exercise PDFBox rather than mocked parsing.
    static byte[] pdf(String text, String password) throws Exception {
        try (var document = new PDDocument(); var output = new ByteArrayOutputStream()) {
            var page = new PDPage();
            document.addPage(page);
            if (text != null) {
                try (var content = new PDPageContentStream(document, page)) {
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 10);
                    content.newLineAtOffset(40, 700);
                    content.showText(text);
                    content.endText();
                }
            }
            if (password != null) {
                document.protect(new StandardProtectionPolicy("owner-secret", password, new AccessPermission()));
            }
            document.save(output);
            return output.toByteArray();
        }
    }

    // Validate PDF contents independently of extension and browser MIME declarations.
    @Test
    void extractsRealPdfAndAllowsAngularOrigin() throws Exception {
        mvc.perform(multipart("/api/cv/extract").file(new MockMultipartFile("file", "cv.bin", "application/octet-stream", pdf("My CV skills", null)))
                .header("Origin", "http://localhost:4200"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"))
            .andExpect(jsonPath("$.text").value(org.hamcrest.Matchers.containsString("My CV skills")));
    }

    // Reject corrupt, disguised, empty, encrypted, scanned, and oversized uploads.
    @Test
    void rejectsInvalidUploadsWithSafeHelpfulMessages() throws Exception {
        byte[][] invalid = { new byte[0], "Not a PDF".getBytes(StandardCharsets.UTF_8),
            "%PDF-1.7\nbroken".getBytes(StandardCharsets.UTF_8), pdf("Private", "secret"),
            pdf("Private", ""), pdf(null, null), pdf(" ", null), pdf("x".repeat(30001), null),
            new byte[(int) CvExtractionController.MAX_BYTES + 1] };
        int[] statuses = {400, 400, 400, 400, 400, 422, 422, 422, 413};
        String[] codes = {"INVALID_PDF", "INVALID_PDF", "INVALID_PDF", "PROTECTED_PDF", "PROTECTED_PDF", "NO_TEXT", "NO_TEXT", "TEXT_TOO_LONG", "FILE_TOO_LARGE"};
        for (int i = 0; i < invalid.length; i++) {
            mvc.perform(multipart("/api/cv/extract").file(new MockMultipartFile("file", "cv.pdf", "application/pdf", invalid[i])))
                .andExpect(status().is(statuses[i])).andExpect(jsonPath("$.code").value(codes[i]))
                .andExpect(jsonPath("$.message").isNotEmpty());
        }
        mvc.perform(multipart("/api/cv/extract")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_UPLOAD"));
    }
}
