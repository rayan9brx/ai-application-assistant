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

class PdfExportControllerTests {
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new PdfExportController(new PdfExportService())).build();
    private final JsonMapper json = JsonMapper.builder().build();

    // Exercise the public endpoint and inspect the real generated document and embedded font.
    @Test
    void exportsLatestEditedGermanTextForBothDocumentTypes() throws Exception {
        String text = "Latest edited CV: Grüße aus Köln — äöü ÄÖÜ ß €\r\n\r\nSecond paragraph\nFinal line";
        for (String type : new String[]{"cv", "motivationLetter"}) {
            byte[] bytes = mvc.perform(post("/api/documents/export").contentType(MediaType.APPLICATION_JSON)
                    .header("Origin", "http://localhost:4200").content(payload(type, text)))
                .andExpect(status().isOk()).andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString(type.equals("cv") ? "cv.pdf" : "motivation-letter-demo.pdf")))
                .andReturn().getResponse().getContentAsByteArray();
            try (var document = Loader.loadPDF(bytes)) {
                String extracted = new PDFTextStripper().getText(document);
                assertTrue(extracted.contains("Latest edited CV: Grüße aus Köln — äöü ÄÖÜ ß €"));
                assertTrue(extracted.replace("\r\n", "\n").contains("Second paragraph\nFinal line"));
                // Only the letter is still a demo template; the CV export is the real document.
                assertEquals(!type.equals("cv"), extracted.contains("DEMO — review before use"));
                for (var name : document.getPage(0).getResources().getFontNames()) {
                    assertTrue(document.getPage(0).getResources().getFont(name).isEmbedded());
                }
                new BoundsChecker().getText(document);
                if (type.equals("cv") && Boolean.getBoolean("pdf.export.preview")) {
                    Path directory = Path.of("target", "pdf-preview");
                    Files.createDirectories(directory);
                    Files.write(directory.resolve("german-sample.pdf"), bytes);
                }
            }
        }
    }

    // Verify long words wrap without data loss and real pages render inside readable margins.
    @Test
    void wrapsLongLinesAndPaginatesWithoutClipping() throws Exception {
        String text = "Portfolio\n\n" + "W".repeat(12000) + "\n" + "Erfahrung und Fähigkeiten.\n".repeat(80) + "LATEST EDIT AT END";
        byte[] bytes = mvc.perform(post("/api/documents/export").contentType(MediaType.APPLICATION_JSON).content(payload("cv", text)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try (var document = Loader.loadPDF(bytes)) {
            assertTrue(document.getNumberOfPages() > 2);
            String extracted = new PDFTextStripper().getText(document);
            assertEquals(12000, extracted.chars().filter(c -> c == 'W').count());
            assertTrue(extracted.contains("LATEST EDIT AT END"));
            assertFalse(extracted.contains("DEMO"));
            new BoundsChecker().getText(document);
            assertNotNull(new PDFRenderer(document).renderImageWithDPI(0, 72));
            // Optional local visual-QA artifacts contain synthetic test content only.
            if (Boolean.getBoolean("pdf.export.preview")) {
                Path directory = Path.of("target", "pdf-preview");
                Files.createDirectories(directory);
                Files.write(directory.resolve("export-sample.pdf"), bytes);
                var renderer = new PDFRenderer(document);
                for (int page = 0; page < document.getNumberOfPages(); page++) {
                    javax.imageio.ImageIO.write(renderer.renderImageWithDPI(page, 90), "png", directory.resolve("page-" + (page + 1) + ".png").toFile());
                }
            }
        }
    }

    // The Simple CV template keeps every word as real, selectable text in reading order.
    @Test
    void cvTemplateKeepsHeadingsAndBulletsAsPlainText() throws Exception {
        String text = "Taylor Brooks\ntaylor@example.com · Hamburg\n\nSummary\nFrontend developer.\n\n"
            + "EXPERIENCE\nFrontend Developer, Northwind Labs  2022 – Present\n- Built a dashboard used by 40 teams\n"
            + "• Cut load time by [add result, e.g. 20%]\n\nSkills:\nReact, TypeScript";
        byte[] bytes = mvc.perform(post("/api/documents/export").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("documentType", "cv", "text", text, "template", "simple"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try (var document = Loader.loadPDF(bytes)) {
            String extracted = new PDFTextStripper().getText(document).replace("\r\n", "\n");
            assertEquals("Taylor Brooks", document.getDocumentInformation().getTitle());
            for (String part : new String[]{"Taylor Brooks", "SUMMARY", "EXPERIENCE", "SKILLS", "• Built a dashboard used by 40 teams",
                    "• Cut load time by [add result, e.g. 20%]", "React, TypeScript"}) {
                assertTrue(extracted.contains(part), part);
            }
            assertTrue(extracted.indexOf("SUMMARY") < extracted.indexOf("EXPERIENCE"));
            new BoundsChecker().getText(document);
        }
    }

    // Reject bad types, missing or excessive text, malformed JSON, and unsupported glyphs safely.
    @Test
    void validatesRequestsWithoutReflectingDocumentText() throws Exception {
        for (String body : new String[]{"{}", payload("cv", ""), payload("cv", "  \n"),
                payload("letter", "private"), payload("../cv.pdf", "private"), payload("cv", "x".repeat(60001)), "{broken"}) {
            mvc.perform(post("/api/documents/export").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.message").isNotEmpty());
        }
        mvc.perform(post("/api/documents/export").contentType(MediaType.APPLICATION_JSON).content(payload("cv", "Emoji 😀")))
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
