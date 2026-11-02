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
