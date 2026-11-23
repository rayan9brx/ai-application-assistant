package com.rayen.backend.cv;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.state.RenderingMode;
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
     * ATS-friendly CV layout in the default template (see {@link #generateCv(String, CvTemplate)}).
     */
    public byte[] generateCv(String text) throws IOException {
        return generateCv(text, CvTemplate.SIMPLE);
    }

    /**
     * ATS-friendly CV layout: one column of real text, the first line as the name, the lines
     * right below it as contact details, standard section headings, "Title, Company   2023 – 2024"
     * lines with the dates on the right, and bullets with a hanging indent. The template only
     * changes sizes, spacing and colours; the frontend's CvSheet renders the same layout.
     */
    public byte[] generateCv(String text, CvTemplate template) throws IOException {
        try (var document = new PDDocument();
             var fontStream = getClass().getResourceAsStream("/fonts/NotoSans-Regular.ttf");
             var output = new ByteArrayOutputStream()) {
            if (fontStream == null) throw new IOException("Export font unavailable");
            var font = PDType0Font.load(document, fontStream, true);
            String[] lines = text.replace("\t", "    ").split("\\R", -1);
            int i = 0;
            while (i < lines.length && lines[i].isBlank()) i++;
            String name = i < lines.length ? lines[i++].strip() : "";
            // Contact lines: up to three lines right under the name, before a blank line or heading.
            List<String> contact = new ArrayList<>();
            while (i < lines.length && contact.size() < 3 && !lines[i].isBlank() && !isHeading(lines[i].strip())) {
                contact.add(lines[i++].strip());
            }
            var writer = new CvWriter(document, font, template);
            writer.header(name, contact);
            for (; i < lines.length; i++) {
                String raw = lines[i];
                String line = raw.strip();
                if (line.isEmpty()) { writer.gap(template == CvTemplate.COMPACT ? 3 : 5); continue; }
                if (isHeading(line)) {
                    writer.heading(line.replaceAll(":$", "").toUpperCase(java.util.Locale.ROOT));
                    continue;
                }
                var bullet = BULLET.matcher(raw);
                var entry = ENTRY.matcher(line);
                if (bullet.find()) writer.bullet(raw.substring(bullet.end()).strip());
                else if (entry.matches() && entry.group(2).chars().anyMatch(Character::isDigit))
                    writer.entry(entry.group(1), entry.group(2));
                else writer.paragraph(line, template.bodySize, 0, 0, template.spacing, INK, false);
            }
            document.getDocumentInformation().setTitle(name.isEmpty() ? "CV" : name);
            writer.close();
            document.save(output);
            return output.toByteArray();
        }
    }

    /** "Role, Company   2023 – Present": two or more spaces, then a short part with a digit. */
    private static final java.util.regex.Pattern ENTRY = java.util.regex.Pattern.compile("^(.*\\S)\\s{2,}(\\S.{0,34})$");

    // The PDF's colours (the frontend's --text, --text-secondary and --primary-* tokens).
    private static final Color INK = new Color(0x1C1B29);
    private static final Color MUTED = new Color(0x5F5E6E);
    private static final Color RULE = new Color(0xC9C8C2);
    private static final Color ACCENT = new Color(0x5B4FD6);
    private static final Color ON_ACCENT = Color.WHITE;
    private static final Color ON_ACCENT_MUTED = new Color(0xE2DFFD);

    private static boolean isHeading(String line) {
        if (line.length() > 40 || line.endsWith(".")) return false;
        if (SECTION.matcher(line).matches()) return true;
        boolean hasLetters = line.codePoints().anyMatch(Character::isLetter);
        return hasLetters && line.length() >= 4 && line.equals(line.toUpperCase(java.util.Locale.ROOT));
    }

    /** Writes flowing text down the page in one template, adding pages as needed. */
    private final class CvWriter {
        private final PDDocument document;
        private final PDType0Font font;
        private final CvTemplate t;
        private final float width;
        private PDPageContentStream content;
        private float y;

        CvWriter(PDDocument document, PDType0Font font, CvTemplate template) throws IOException {
            this.document = document;
            this.font = font;
            this.t = template;
            this.width = PDRectangle.A4.getWidth() - 2 * template.margin;
            newPage();
        }

        void gap(float points) { y -= points; }

        /** The name and contact lines; in Creative they sit in a coloured bar across the top. */
        void header(String name, List<String> contact) throws IOException {
            float subSize = t.bodySize - 0.5f;
            if (t.topBar) {
                float pad = 30;
                int nameLines = name.isEmpty() ? 0 : wrapAt(name, t.nameSize, width).size();
                int subLines = 0;
                for (String line : contact) subLines += wrapAt(line, subSize, width).size();
                float height = pad * 2 + nameLines * leading(t.nameSize, 0.1f)
                    + (subLines > 0 ? 4 + subLines * leading(subSize, t.spacing) : 0) - 6;
                float top = PDRectangle.A4.getHeight();
                content.setNonStrokingColor(ACCENT);
                content.addRect(0, top - height, PDRectangle.A4.getWidth(), height);
                content.fill();
                y = top - pad;
                if (!name.isEmpty()) paragraph(name, t.nameSize, 0, 0, 0.1f, ON_ACCENT, true);
                if (!contact.isEmpty()) gap(4);
                for (String line : contact) paragraph(line, subSize, 0, 0, t.spacing, ON_ACCENT_MUTED, false);
                y = top - height - 18;
                return;
            }
            if (!name.isEmpty()) paragraph(name, t.nameSize, 0, 0, 0.1f, t.accentName ? ACCENT : INK, true);
            if (!contact.isEmpty()) gap(t == CvTemplate.COMPACT ? 1 : 3);
            for (String line : contact) paragraph(line, subSize, 0, 0, t.spacing, MUTED, false);
            gap(t == CvTemplate.COMPACT ? 2 : 4);
        }

        void heading(String text) throws IOException {
            gap(t.sectionGap);
            // Keep a heading together with the first lines below it.
            ensure(leading(t.headingSize, 0.12f) + 3 * leading(t.bodySize, t.spacing));
            Color color = t.accentHeads ? ACCENT : INK;
            float indent = 0;
            if (t.topBar) {
                // Creative: a small accent square before the heading (decoration, not content).
                float side = t.headingSize * 0.55f;
                content.setNonStrokingColor(ACCENT);
                content.addRect(t.margin, y - t.headingSize * 0.78f, side, side);
                content.fill();
                indent = side + 7;
            }
            paragraph(text, t.headingSize, indent, indent, 0.12f, color, true);
            if (t.rule) {
                content.setStrokingColor(t.accentHeads ? ACCENT : t == CvTemplate.COMPACT ? RULE : INK);
                content.setLineWidth(t.accentHeads ? 0.9f : 0.6f);
                content.moveTo(t.margin, y + 1);
                content.lineTo(t.margin + width, y + 1);
                content.stroke();
            }
            gap(t == CvTemplate.COMPACT ? 3 : 5);
        }

        void bullet(String text) throws IOException {
            float size = t.bodySize;
            ensure(leading(size, t.spacing));
            drawText(content, font, size, t.margin + 4, y - size, "•", t.accentHeads ? ACCENT : INK, false);
            paragraph(text, size, 14, 14, t.spacing, INK, false);
            gap(t == CvTemplate.COMPACT ? 0.5f : 1.5f);
        }

        /** A role or degree line: the title on the left (bold), the dates on the right. */
        void entry(String title, String dates) throws IOException {
            float size = t.bodySize;
            float datesWidth = width(dates, size);
            List<String> lines = wrapAt(title, size, width - datesWidth - 12);
            float leading = leading(size, t.spacing);
            gap(t == CvTemplate.COMPACT ? 1 : 2);
            for (int i = 0; i < lines.size(); i++) {
                ensure(leading);
                drawText(content, font, size, t.margin, y - size, lines.get(i), INK, true);
                if (i == 0) drawText(content, font, size, t.margin + width - datesWidth, y - size, dates, MUTED, false);
                y -= leading;
            }
        }

        /** Wraps text to the page width; `indent` and `hanging` shift the first and following lines. */
        void paragraph(String text, float size, float indent, float hanging, float spacing, Color color, boolean bold)
                throws IOException {
            float leading = leading(size, spacing);
            List<String> lines = wrapAt(text, size, width - Math.max(indent, hanging));
            for (int i = 0; i < lines.size(); i++) {
                ensure(leading);
                drawText(content, font, size, t.margin + (i == 0 ? indent : hanging), y - size, lines.get(i), color, bold);
                y -= leading;
            }
        }

        private float leading(float size, float spacing) {
            return size * (1.3f + spacing);
        }

        private float width(String text, float size) throws IOException {
            try {
                return font.getStringWidth(text) / 1000 * size;
            } catch (IllegalArgumentException exception) {
                throw new UnsupportedCharacterException();
            }
        }

        private List<String> wrapAt(String text, float size, float width) throws IOException {
            return wrap(text, font, width * FONT_SIZE / size);
        }

        private void ensure(float height) throws IOException {
            if (y - height < t.margin) newPage();
        }

        private void newPage() throws IOException {
            if (content != null) content.close();
            var page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            content = new PDPageContentStream(document, page);
            y = page.getMediaBox().getHeight() - t.margin;
        }

        void close() throws IOException {
            content.close();
        }
    }

    // Place text in a colour; "bold" strokes the outline too, since only the regular font is bundled.
    private void drawText(PDPageContentStream content, PDType0Font font, float size, float x, float y, String text,
                          Color color, boolean bold) throws IOException {
        content.setNonStrokingColor(color);
        if (bold) {
            content.setStrokingColor(color);
            content.setLineWidth(size * 0.035f);
        }
        content.beginText();
        content.setRenderingMode(bold ? RenderingMode.FILL_STROKE : RenderingMode.FILL);
        content.setFont(font, size);
        content.newLineAtOffset(x, y);
        content.showText(text);
        content.endText();
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
