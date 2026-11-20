package com.rayen.backend;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Service;

@Service
public class PdfExportService {
    private static final float MARGIN = 50;
    private static final float FONT_SIZE = 11;
    private static final float LEADING = 16;

    // Build a text-only PDF in memory with an embedded, bundled Unicode font.
    public byte[] generate(String text) throws IOException {
        try (var document = new PDDocument();
             var fontStream = getClass().getResourceAsStream("/fonts/NotoSans-Regular.ttf");
             var output = new ByteArrayOutputStream()) {
            if (fontStream == null) throw new IOException("Export font unavailable");
            var font = PDType0Font.load(document, fontStream, true);
            List<String> lines = new ArrayList<>();
            for (String paragraph : text.replace("\t", "    ").split("\\R", -1)) {
                lines.addAll(wrap(paragraph, font, PDRectangle.A4.getWidth() - 2 * MARGIN));
            }
            int offset = 0;
            int linesPerPage = (int) ((PDRectangle.A4.getHeight() - 76 - MARGIN) / LEADING) + 1;
            while (offset < lines.size()) {
                var page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                try (var content = new PDPageContentStream(document, page)) {
                    drawText(content, font, 8, MARGIN, page.getMediaBox().getHeight() - 40, "DEMO — review before use");
                    float baseline = page.getMediaBox().getHeight() - 76;
                    int end = Math.min(offset + linesPerPage, lines.size());
                    while (offset < end) {
                        drawText(content, font, FONT_SIZE, MARGIN, baseline, lines.get(offset++));
                        baseline -= LEADING;
                    }
                    drawText(content, font, 8, MARGIN, 28, "Page " + document.getNumberOfPages());
                }
            }
            document.save(output);
            return output.toByteArray();
        }
    }

    private static final java.util.regex.Pattern SECTION = java.util.regex.Pattern.compile(
        "(?i)(professional |work |career )?(summary|profile|about me|experience|employment|employment history|work history|"
            + "education|skills|technical skills|key skills|projects|certifications|certificates|languages|interests|awards|"
            + "volunteering|publications|references|zusammenfassung|profil|berufserfahrung|erfahrung|ausbildung|bildung|"
            + "kenntnisse|fähigkeiten|kompetenzen|projekte|sprachen|zertifikate|interessen)\\s*:?");
    private static final java.util.regex.Pattern BULLET = java.util.regex.Pattern.compile("^\\s*[-•*–▪●]\\s+");

    /**
     * ATS-friendly CV layout: one column of real text, the first line as the name, standard
     * section headings with a rule under them, and bullets with a hanging indent.
     */
    public byte[] generateCv(String text) throws IOException {
        try (var document = new PDDocument();
             var fontStream = getClass().getResourceAsStream("/fonts/NotoSans-Regular.ttf");
             var output = new ByteArrayOutputStream()) {
            if (fontStream == null) throw new IOException("Export font unavailable");
            var font = PDType0Font.load(document, fontStream, true);
            var writer = new CvWriter(document, font);
            String[] lines = text.replace("\t", "    ").split("\\R", -1);
            boolean nameDone = false;
            for (String raw : lines) {
                String line = raw.strip();
                if (line.isEmpty()) { writer.gap(5); continue; }
                if (!nameDone) {
                    writer.paragraph(line, 20, 0, 0, 0.1f);
                    writer.gap(4);
                    nameDone = true;
                } else if (isHeading(line)) {
                    writer.heading(line.replaceAll(":$", "").toUpperCase(java.util.Locale.ROOT));
                } else {
                    var bullet = BULLET.matcher(raw);
                    if (bullet.find()) writer.bullet(raw.substring(bullet.end()).strip());
                    else writer.paragraph(line, 10.5f, 0, 0, 0.15f);
                }
            }
            document.getDocumentInformation().setTitle(lines.length > 0 ? lines[0].strip() : "CV");
            writer.close();
            document.save(output);
            return output.toByteArray();
        }
    }

    private static boolean isHeading(String line) {
        if (line.length() > 40 || line.endsWith(".")) return false;
        if (SECTION.matcher(line).matches()) return true;
        boolean hasLetters = line.codePoints().anyMatch(Character::isLetter);
        return hasLetters && line.length() >= 4 && line.equals(line.toUpperCase(java.util.Locale.ROOT));
    }

    /** Writes flowing text down the page, adding pages as needed. */
    private final class CvWriter {
        private static final float WIDTH = PDRectangle.A4.getWidth() - 2 * MARGIN;
        private final PDDocument document;
        private final PDType0Font font;
        private PDPageContentStream content;
        private float y;

        CvWriter(PDDocument document, PDType0Font font) throws IOException {
            this.document = document;
            this.font = font;
            newPage();
        }

        void gap(float points) { y -= points; }

        void heading(String text) throws IOException {
            gap(10);
            ensure(30);
            paragraph(text, 11.5f, 0, 0, 0.12f);
            content.setLineWidth(0.6f);
            content.moveTo(MARGIN, y + 3);
            content.lineTo(MARGIN + WIDTH, y + 3);
            content.stroke();
            gap(6);
        }

        void bullet(String text) throws IOException {
            float size = 10.5f;
            ensure(size * 1.45f);
            drawText(content, font, size, MARGIN + 4, y - size, "•");
            paragraph(text, size, 14, 14, 0.15f);
            gap(1.5f);
        }

        /** Wraps text to the page width; `indent` and `hanging` shift the first and following lines. */
        void paragraph(String text, float size, float indent, float hanging, float spacing) throws IOException {
            float leading = size * (1.3f + spacing);
            List<String> lines = wrapAt(text, size, WIDTH - Math.max(indent, hanging));
            for (int i = 0; i < lines.size(); i++) {
                ensure(leading);
                drawText(content, font, size, MARGIN + (i == 0 ? indent : hanging), y - size, lines.get(i));
                y -= leading;
            }
        }

        private List<String> wrapAt(String text, float size, float width) throws IOException {
            return wrap(text, font, width * FONT_SIZE / size);
        }

        private void ensure(float height) throws IOException {
            if (y - height < MARGIN) newPage();
        }

        private void newPage() throws IOException {
            if (content != null) content.close();
            var page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            content = new PDPageContentStream(document, page);
            y = page.getMediaBox().getHeight() - MARGIN;
        }

        void close() throws IOException {
            content.close();
        }
    }

    // Prefer whitespace breaks and split long unbroken text at Unicode code-point boundaries.
    private List<String> wrap(String paragraph, PDType0Font font, float maxWidth) throws IOException {
        var lines = new ArrayList<String>();
        if (paragraph.isEmpty()) return List.of("");
        int start = 0;
        while (start < paragraph.length()) {
            int end = start;
            int breakAt = -1;
            float width = 0;
            while (end < paragraph.length()) {
                int codePoint = paragraph.codePointAt(end);
                String glyph = new String(Character.toChars(codePoint));
                float nextWidth;
                try {
                    nextWidth = font.getStringWidth(glyph) / 1000 * FONT_SIZE;
                } catch (IllegalArgumentException exception) {
                    throw new UnsupportedCharacterException();
                }
                if (width + nextWidth > maxWidth) break;
                width += nextWidth;
                end += Character.charCount(codePoint);
                if (Character.isWhitespace(codePoint)) breakAt = end;
            }
            if (end == start) throw new UnsupportedCharacterException();
            if (end < paragraph.length() && breakAt > start) end = breakAt;
            lines.add(paragraph.substring(start, end));
            start = end;
        }
        return lines;
    }

    // Place each baseline explicitly so paragraph breaks and page margins stay predictable.
    private void drawText(PDPageContentStream content, PDType0Font font, float size, float x, float y, String text) throws IOException {
        content.beginText();
        content.setFont(font, size);
        content.newLineAtOffset(x, y);
        content.showText(text);
        content.endText();
    }

    static class UnsupportedCharacterException extends RuntimeException {}
}
