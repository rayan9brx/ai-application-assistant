package com.rayen.backend.cv;

import java.nio.file.*;
import java.util.Map;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** The motivation letter export; CV PDFs are printed in the browser from CvSheet. */
class PdfExportControllerTests {
    private static final String LETTER = "motivationLetter";
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new PdfExportController(new PdfExportService())).build();
    private final JsonMapper json = JsonMapper.builder().build();

    // Exercise the public endpoint and inspect the real generated document and embedded font.
    @Test
    void exportsLatestEditedGermanText() throws Exception {
        String text = "Latest edited letter: Grüße aus Köln — äöü ÄÖÜ ß €\r\n\r\nSecond paragraph\nFinal line";
        byte[] bytes = mvc.perform(post("/api/documents/export").contentType(MediaType.APPLICATION_JSON)
                .header("Origin", "http://localhost:4200").content(payload(LETTER, text)))
            .andExpect(status().isOk()).andExpect(content().contentType(MediaType.APPLICATION_PDF))
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("motivation-letter-demo.pdf")))
            .andReturn().getResponse().getContentAsByteArray();
        try (var document = Loader.loadPDF(bytes)) {
            String extracted = new PDFTextStripper().getText(document);
            assertTrue(extracted.contains("Latest edited letter: Grüße aus Köln — äöü ÄÖÜ ß €"));
            assertTrue(extracted.replace("\r\n", "\n").contains("Second paragraph\nFinal line"));
            assertTrue(extracted.contains("DEMO — review before use"));
            for (var name : document.getPage(0).getResources().getFontNames()) {
                assertTrue(document.getPage(0).getResources().getFont(name).isEmbedded());
            }
            new BoundsChecker().getText(document);
        }
    }

    // Verify long words wrap without data loss and real pages render inside readable margins.
    @Test
    void wrapsLongLinesAndPaginatesWithoutClipping() throws Exception {
        String text = "Portfolio\n\n" + "W".repeat(12000) + "\n" + "Erfahrung und Fähigkeiten.\n".repeat(80) + "LATEST EDIT AT END";
        byte[] bytes = mvc.perform(post("/api/documents/export").contentType(MediaType.APPLICATION_JSON).content(payload(LETTER, text)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try (var document = Loader.loadPDF(bytes)) {
            assertTrue(document.getNumberOfPages() > 2);
            String extracted = new PDFTextStripper().getText(document);
            assertEquals(12000, extracted.chars().filter(c -> c == 'W').count());
            assertTrue(extracted.contains("LATEST EDIT AT END"));
            new BoundsChecker().getText(document);
            assertNotNull(new PDFRenderer(document).renderImageWithDPI(0, 72));
            // Optional local visual-QA artifacts contain synthetic test content only.
            if (Boolean.getBoolean("pdf.export.preview")) {
                Path directory = Path.of("target", "pdf-preview");
                Files.createDirectories(directory);
                Files.write(directory.resolve("export-sample.pdf"), bytes);
            }
        }
    }

    // Reject bad types (CVs included), missing or excessive text, malformed JSON, and unsupported glyphs safely.
    @Test
    void validatesRequestsWithoutReflectingDocumentText() throws Exception {
        for (String body : new String[]{"{}", payload(LETTER, ""), payload(LETTER, "  \n"), payload("cv", "private"),
                payload("letter", "private"), payload("../cv.pdf", "private"), payload(LETTER, "x".repeat(60001)), "{broken"}) {
            mvc.perform(post("/api/documents/export").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.message").isNotEmpty());
        }
        mvc.perform(post("/api/documents/export").contentType(MediaType.APPLICATION_JSON).content(payload(LETTER, "Emoji 😀")))
            .andExpect(status().is(422)).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("characters")));
    }

    // Serialize controlled fixtures with the application's Jackson generation.
    private String payload(String type, String text) {
        return json.writeValueAsString(Map.of("documentType", type, "text", text));
    }

    private static class BoundsChecker extends PDFTextStripper {
        // Read positions from every page to catch horizontal or vertical clipping.
        BoundsChecker() throws java.io.IOException { super(); }
        @Override protected void processTextPosition(TextPosition text) {
            assertTrue(text.getXDirAdj() >= 49);
            assertTrue(text.getXDirAdj() + text.getWidthDirAdj() <= 546.5);
            assertTrue(text.getYDirAdj() >= 28 && text.getYDirAdj() <= 815);
            super.processTextPosition(text);
        }
    }
}
