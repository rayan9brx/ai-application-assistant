package com.rayen.backend.cv;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionURI;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDBorderStyleDictionary;

/**
 * The "Classic" CV template: A4, Carlito (metric-compatible with Calibri), black text, blue
 * underlined links, one column of real text. The frontend's classic-cv.ts parses the same way
 * and CvSheet draws the same layout for the preview.
 *
 * <p>Layout: A4 with 1.5 cm side and 1.2 cm top/bottom margins; name (20pt bold), target title
 * (14pt bold), one contact line (11pt) with small
 * vector icons and a thin rule below it, the summary justified right below, then sections with a 14pt bold heading over a
 * thin full-width rule. Entries put the bold title left and the dates right; certificates are
 * one plain line each; skills lines are "Label: items" with the label in bold.
 */
final class ClassicCvRenderer {
    private static final float CM = 72 / 2.54f;
    private static final float MARGIN_X = 1.5f * CM;
    private static final float MARGIN_Y = 1.2f * CM;
    private static final float NAME = 20;
    private static final float TITLE = 14;
    private static final float HEADING = 14;
    private static final float BULLET_INDENT = 14;
    private static final Color INK = Color.BLACK;
    /** The usual hyperlink blue (the frontend's --cv-link token). */
    private static final Color LINK = new Color(0x0563C1);

    // ---- Parsing (mirrors classic-cv.ts) --------------------------------------------------------

    enum Contact { LOCATION, EMAIL, PHONE, LINKEDIN, GITHUB, LINK }

    record Run(String text, boolean bold, String href) {}

    private static final Pattern SECTION = Pattern.compile(
        "(?i)(professional |work |career )?(summary|profile|about me|experience|employment|employment history|work history|"
            + "education|skills|technical skills|key skills|skills & interests|projects|certifications|certificates|languages|"
            + "interests|awards|awards & scholarships|volunteering|volunteering & leadership|publications|references|"
            + "zusammenfassung|profil|kurzprofil|berufserfahrung|erfahrung|praxiserfahrung|ausbildung|bildung|kenntnisse|"
            + "fähigkeiten|kompetenzen|projekte|sprachen|zertifikate|interessen)\\s*:?");
    private static final Pattern SUMMARY = Pattern.compile(
        "(?i)(professional |career )?(summary|profile|about me|zusammenfassung|profil|kurzprofil)");
    /** Headings not in SECTION or in capitals: "Selected Projects", "Certificates & Further Training". */
    private static final Pattern LOOSE_SECTION = Pattern.compile(
        "(?iU)^(?:[\\p{L}-]+ ){0,2}(summary|profile|experience|employment|education|studies|skills|competencies|expertise|"
            + "projects|certifications|certificates|further training|trainings|courses|languages|interests|awards|scholarships|"
            + "honou?rs|volunteering|leadership|publications|references|zusammenfassung|profil|kurzprofil|berufserfahrung|"
            + "erfahrung|praxiserfahrung|ausbildung|bildung|studium|kenntnisse|fähigkeiten|kompetenzen|projekte|sprachen|"
            + "zertifikate|weiterbildungen?|fortbildungen?|interessen|ehrenamt)(?: ?(?:&|and|und|/) ?[^\\d,@]{1,30})?:?$");
    private static final Pattern SKILLS = Pattern.compile("(?i).*(skill|kenntnisse|fähigkeit|kompetenz|languages|sprachen|interest|interessen).*");
    private static final Pattern CERTIFICATES = Pattern.compile(
        "(?i).*(certif|zertifikat|training|weiterbildung|fortbildung|course|kurse).*");
    private static final Pattern BULLET = Pattern.compile("^\\s*[-•*–▪●]\\s+");
    private static final Pattern ENTRY = Pattern.compile("^(.*\\S)\\s{2,}(\\S.{0,34})$");
    /** A certificate line whose year (or date range) ends it after a single space. */
    private static final Pattern TRAILING_YEAR = Pattern.compile(
        "(?i)^(.*\\S)\\s+\\(?((?:(?:\\d{1,2}[./]\\s?|[A-Za-zäöü]{3,9}\\.? )?(?:19|20)\\d{2})"
            + "(?:\\s*[–-]\\s*(?:(?:\\d{1,2}[./]\\s?|[A-Za-zäöü]{3,9}\\.? )?(?:19|20)\\d{2}|present|heute|now))?)\\)?$");
    private static final Pattern PROSE_MARKERS = Pattern.compile("(?i).*(@|https?:|www\\.|linkedin|github|\\s[·|•]\\s).*");
    private static final Pattern LABEL = Pattern.compile("^([^:]{1,40}):\\s+(\\S.*)$");
    private static final Pattern SEPARATOR = Pattern.compile("\\s+[·|•]\\s+");
    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+");
    private static final Pattern PHONE = Pattern.compile("^\\+?[\\d\\s()/.-]{6,}$");
    private static final Pattern URL = Pattern.compile(
        "(?i)(https?://\\S+|www\\.\\S+|(linkedin\\.com|github\\.com|gitlab\\.com|xing\\.com)/\\S*|[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+)");

    static boolean isHeading(String line) {
        if (line.length() > 40 || line.endsWith(".")) return false;
        if (SECTION.matcher(line).matches()) return true;
        if (!line.isEmpty() && Character.isUpperCase(line.codePointAt(0)) && LOOSE_SECTION.matcher(line).matches()) return true;
        boolean hasLetters = line.codePoints().anyMatch(Character::isLetter);
        return hasLetters && line.length() >= 4 && line.equals(line.toUpperCase(Locale.ROOT));
    }

    /** A long sentence-like line: the summary, never part of the header. */
    static boolean isProse(String line) {
        return line.length() > 60 && !PROSE_MARKERS.matcher(line).matches();
    }

    /** Splits "a, b (x, y); c · d" into items, never inside parentheses. */
    static List<String> skillItems(String text) {
        List<String> items = new ArrayList<>();
        int depth = 0;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch == '(' || ch == '[') depth++;
            if (ch == ')' || ch == ']') depth = Math.max(0, depth - 1);
            boolean middot = (ch == '·' || ch == '•' || ch == '|') && i > 0 && text.charAt(i - 1) == ' ';
            if (depth == 0 && (ch == ',' || ch == ';' || middot)) {
                items.add(current.toString().strip());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        items.add(current.toString().strip());
        items.removeIf(String::isEmpty);
        return items;
    }

    /**
     * Merges skill groups with the same label into the first one and drops repeated items
     * (mirrors mergeSkillLines in classic-cv.ts). Lines that need no change stay as they are.
     */
    static List<String> mergeSkillLines(List<String> lines) {
        record Group(int index, String prefix, String label, List<String> items, boolean[] changed) {}
        List<String> out = new ArrayList<>();
        var groups = new java.util.LinkedHashMap<String, Group>();
        for (String line : lines) {
            Matcher bullet = BULLET.matcher(line);
            String prefix = bullet.find() ? bullet.group() : "";
            Matcher label = LABEL.matcher(line.substring(prefix.length()).strip());
            if (!label.matches()) {
                out.add(line);
                continue;
            }
            String key = label.group(1).strip().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
            Group group = groups.get(key);
            if (group == null) {
                group = new Group(out.size(), prefix, label.group(1).strip(), new ArrayList<>(), new boolean[1]);
                groups.put(key, group);
                out.add(line);
            } else {
                group.changed()[0] = true;
                out.add(null);
            }
            for (String item : skillItems(label.group(2))) {
                if (group.items().stream().anyMatch(known -> known.equalsIgnoreCase(item))) group.changed()[0] = true;
                else group.items().add(item);
            }
        }
        for (Group group : groups.values()) {
            if (group.changed()[0]) out.set(group.index(), group.prefix() + group.label() + ": " + String.join(", ", group.items()));
        }
        out.removeIf(java.util.Objects::isNull);
        return out;
    }

    /** mergeSkillLines for every skills section of a CV text's lines. */
    static String[] mergeSkillSections(String[] lines) {
        List<String> out = new ArrayList<>();
        int i = 0;
        while (i < lines.length) {
            String line = lines[i].strip();
            out.add(lines[i++]);
            if (line.isEmpty() || !isHeading(line) || !SKILLS.matcher(line).matches()) continue;
            int start = i;
            while (i < lines.length && !(!lines[i].isBlank() && isHeading(lines[i].strip()))) i++;
            out.addAll(mergeSkillLines(java.util.Arrays.asList(lines).subList(start, i)));
        }
        return out.toArray(String[]::new);
    }

    /** Joins a summary's wrapped lines into paragraphs: an empty line or a bullet starts a new one. */
    static List<String> summaryParagraphs(List<String> lines) {
        List<String> paragraphs = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String raw : lines) {
            String line = raw.strip();
            Matcher bullet = BULLET.matcher(raw);
            if (line.isEmpty() || bullet.find()) {
                if (!current.isEmpty()) paragraphs.add(current.toString());
                current.setLength(0);
                if (!line.isEmpty()) paragraphs.add(BULLET.matcher(line).replaceFirst(""));
                continue;
            }
            if (current.isEmpty()) current.append(line);
            else if (current.toString().matches("(?s).*\\p{L}-$")) current.append(line);
            else current.append(' ').append(line);
        }
        if (!current.isEmpty()) paragraphs.add(current.toString());
        return paragraphs;
    }

    /** "https://www.linkedin.com/in/rayen/" → "linkedin.com/in/rayen". */
    static String shortLink(String link) {
        return link.replaceFirst("(?i)^https?://", "").replaceFirst("(?i)^www\\.", "").replaceFirst("/+$", "");
    }

    static Contact contactKind(String item) {
        String lower = item.toLowerCase(Locale.ROOT);
        if (EMAIL.matcher(item).matches()) return Contact.EMAIL;
        if (lower.contains("linkedin.")) return Contact.LINKEDIN;
        if (lower.contains("github.")) return Contact.GITHUB;
        if (lower.startsWith("http") || lower.startsWith("www.") || lower.matches("[\\w-]+(\\.[\\w-]+)+/\\S*"))
            return Contact.LINK;
        if (PHONE.matcher(item).matches() && item.chars().filter(Character::isDigit).count() >= 6) return Contact.PHONE;
        return Contact.LOCATION;
    }

    /** "Portfolio: rayen.dev" from the builder's extra links: the label shows, the URL is the target. */
    private static final Pattern LABELED_LINK = Pattern.compile("^([^:]{1,30}):\\s+(\\S+\\.\\S+)$");

    /** shortText: the text without "https://", "www." and a trailing slash, for a too-long line. */
    record ContactItem(Contact kind, String text, String shortText, String href) {}

    static ContactItem contactItem(String item) {
        Matcher labeled = LABELED_LINK.matcher(item);
        if (labeled.matches() && !labeled.group(1).matches("(?i)https?|www.*")) {
            Contact kind = contactKind(labeled.group(2));
            if (kind == Contact.LOCATION || kind == Contact.PHONE) kind = Contact.LINK;
            return new ContactItem(kind, labeled.group(1).strip(), labeled.group(1).strip(), href(labeled.group(2)));
        }
        Contact kind = contactKind(item);
        boolean link = kind != Contact.LOCATION && kind != Contact.PHONE;
        return new ContactItem(kind, item, link ? shortLink(item) : item, link ? href(item) : null);
    }

    /** A header line counts as contact details when one of its items is an email, phone or link. */
    private static boolean isContactLine(String line) {
        for (String item : SEPARATOR.split(line)) {
            if (contactItem(item.strip()).kind() != Contact.LOCATION) return true;
        }
        return false;
    }

    static String href(String link) {
        String value = link.replaceAll("[.,;:)]+$", "");
        if (EMAIL.matcher(value).matches()) return "mailto:" + value;
        return value.matches("(?i)https?://.*") ? value : "https://" + value;
    }

    /** Splits text into runs, with links (URLs and emails) as their own runs. */
    static List<Run> runs(String text, boolean bold) {
        List<Run> runs = new ArrayList<>();
        Matcher m = URL.matcher(text);
        int at = 0;
        while (m.find()) {
            String link = m.group().replaceAll("[.,;:)]+$", "");
            if (m.start() > at) runs.add(new Run(text.substring(at, m.start()), bold, null));
            runs.add(new Run(link, bold, href(link)));
            at = m.start() + link.length();
        }
        if (at < text.length()) runs.add(new Run(text.substring(at), bold, null));
        return runs;
    }

    // ---- Rendering --------------------------------------------------------------------------------

    private final PDDocument document;
    private final PDType0Font regular;
    private final PDType0Font bold;
    private final float width = PDRectangle.A4.getWidth() - 2 * MARGIN_X;
    private final float body;
    private final float lineFactor;
    private final float gaps;
    private PDPage page;
    private PDPageContentStream content;
    private float y;

    /**
     * Fit-to-page steps, tried in order until the CV fits one page (the last one otherwise): body
     * size (never below 10pt), line height, factor for every gap. Same values as FITS in cv-sheet.ts.
     */
    private record Fit(float body, float line, float gaps) {}
    private static final Fit[] FITS = {
        new Fit(11, 1.15f, 1), new Fit(11, 1.1f, 0.8f), new Fit(10.5f, 1.08f, 0.65f), new Fit(10, 1.05f, 0.5f),
    };
    /** Contact line (pt): font size, smallest size, shrink step, icon, icon-text gap, item gap. */
    private static final float CONTACT_SIZE = 9.5f;
    private static final float CONTACT_MIN_SIZE = 8;
    private static final float CONTACT_STEP = 0.25f;
    private static final float CONTACT_ICON = 8;
    private static final float CONTACT_ICON_GAP = 2;
    private static final float CONTACT_GAP = 8;

    private ClassicCvRenderer(PDDocument document, PDType0Font regular, PDType0Font bold, Fit fit) {
        this.document = document;
        this.regular = regular;
        this.bold = bold;
        this.body = fit.body();
        this.lineFactor = fit.line();
        this.gaps = fit.gaps();
    }

    /** Renders at the first fit step that gives one page; content is never removed. */
    static byte[] render(String text) throws IOException {
        for (int level = 0; ; level++) {
            var result = render(text, FITS[level]);
            if (result.pages() <= 1 || level == FITS.length - 1) return result.bytes();
        }
    }

    private record Rendered(byte[] bytes, int pages) {}

    private static Rendered render(String text, Fit fit) throws IOException {
        try (var document = new PDDocument();
             InputStream regularStream = ClassicCvRenderer.class.getResourceAsStream("/fonts/Carlito-Regular.ttf");
             InputStream boldStream = ClassicCvRenderer.class.getResourceAsStream("/fonts/Carlito-Bold.ttf");
             var output = new ByteArrayOutputStream()) {
            if (regularStream == null || boldStream == null) throw new IOException("Export font unavailable");
            var renderer = new ClassicCvRenderer(document,
                PDType0Font.load(document, regularStream, true), PDType0Font.load(document, boldStream, true), fit);
            String name = renderer.write(text);
            document.getDocumentInformation().setTitle(name.isEmpty() ? "CV" : name);
            renderer.content.close();
            document.save(output);
            return new Rendered(output.toByteArray(), document.getNumberOfPages());
        }
    }

    /** Lays out the whole CV; returns the name for the document title. */
    private String write(String text) throws IOException {
        newPage();
        String[] lines = mergeSkillSections(text.replace("\t", "    ").split("\\R", -1));
        int i = 0;
        while (i < lines.length && lines[i].isBlank()) i++;
        String name = i < lines.length ? lines[i++].strip() : "";
        String title = null;
        List<String> contactItems = new ArrayList<>();
        // The header ends at the first prose line: that is the summary, which is never cut.
        for (int n = 0; n < 3 && i < lines.length && !lines[i].isBlank() && !isHeading(lines[i].strip())
                && !isProse(lines[i].strip()); n++, i++) {
            String line = lines[i].strip();
            if (title == null && contactItems.isEmpty() && !isContactLine(line)) title = line;
            else for (String item : SEPARATOR.split(line)) if (!item.isBlank()) contactItems.add(item.strip());
        }

        if (!name.isEmpty()) paragraph(List.of(new Run(name, true, null)), NAME, 0, 0, false);
        if (title != null) { gap(1); paragraph(List.of(new Run(title, true, null)), TITLE, 0, 0, false); }
        if (!contactItems.isEmpty()) { gap(3); contactLine(contactItems); }
        if (!name.isEmpty() || title != null || !contactItems.isEmpty()) headerRule();

        // A summary (with its heading, or the text before the first heading) goes right below the
        // header, justified, without a heading; its wrapped lines are joined into paragraphs.
        while (i < lines.length && lines[i].isBlank()) i++;
        if (i < lines.length) {
            String first = lines[i].strip();
            boolean summaryHeading = SUMMARY.matcher(first.replaceAll(":$", "")).matches();
            if (summaryHeading || !isHeading(first)) {
                if (summaryHeading) i++;
                List<String> summaryLines = new ArrayList<>();
                for (; i < lines.length && !isHeading(lines[i].strip()); i++) summaryLines.add(lines[i]);
                List<String> paragraphs = summaryParagraphs(summaryLines);
                if (!paragraphs.isEmpty()) gap(5);
                for (String paragraph : paragraphs) paragraph(runs(paragraph, false), body, 0, 0, true);
            }
        }

        String section = "";
        boolean afterHeading = false;
        for (; i < lines.length; i++) {
            String raw = lines[i];
            String line = raw.strip();
            if (line.isEmpty()) { gap(3); continue; }
            if (isHeading(line)) {
                section = line.replaceAll(":$", "");
                heading(section);
                afterHeading = true;
                continue;
            }
            boolean certificates = CERTIFICATES.matcher(section).matches();
            Matcher bullet = BULLET.matcher(raw);
            Matcher entry = ENTRY.matcher(line);
            if (!entry.matches() && certificates) entry = TRAILING_YEAR.matcher(line);
            Matcher label = LABEL.matcher(line);
            if (bullet.find()) {
                bulletLine(runs(raw.substring(bullet.end()).strip(), false));
            } else if (entry.matches() && entry.group(2).chars().anyMatch(Character::isDigit)) {
                if (!afterHeading && !certificates) gap(2);
                entry(entry.group(1), entry.group(2), !certificates);
            } else if (SKILLS.matcher(section).matches() && label.matches()) {
                List<Run> runs = new ArrayList<>();
                runs.add(new Run(label.group(1) + ":", true, null));
                runs.add(new Run(" ", false, null));
                runs.addAll(runs(label.group(2), false));
                paragraph(runs, body, 0, 0, false);
            } else {
                paragraph(runs(line, false), body, 0, 0, false);
            }
            afterHeading = false;
        }
        return name;
    }

    private void heading(String text) throws IOException {
        gap(9);
        // Keep the heading with the first lines below it.
        ensure(HEADING * lineFactor + 3 + 2 * body * lineFactor);
        paragraph(List.of(new Run(text, true, null)), HEADING, 0, 0, false);
        content.setStrokingColor(INK);
        content.setLineWidth(0.6f);
        content.moveTo(MARGIN_X, y + 1.5f);
        content.lineTo(MARGIN_X + width, y + 1.5f);
        content.stroke();
        gap(4);
    }

    private void bulletLine(List<Run> runs) throws IOException {
        ensure(body * lineFactor);
        draw("•", regular, body, MARGIN_X + 4, y - body * 0.85f, INK);
        paragraph(runs, body, BULLET_INDENT, BULLET_INDENT, false);
        gap(0.5f);
    }

    /** Title left, dates right on the same line; the title wraps before the dates if needed. */
    private void entry(String title, String dates, boolean boldTitle) throws IOException {
        float datesWidth = width(regular, dates, body);
        float lineHeight = body * lineFactor;
        List<List<Word>> lines = wrap(runs(title, boldTitle), body, width - datesWidth - 12);
        for (int i = 0; i < lines.size(); i++) {
            ensure(lineHeight);
            float baseline = y - body * 0.85f;
            drawLine(lines.get(i), MARGIN_X, baseline, body, 0);
            if (i == 0) draw(dates, regular, body, MARGIN_X + width - datesWidth, baseline, INK);
            y -= lineHeight;
        }
    }

    /** The widths of the contact items (icon, space, text) with full or short texts. */
    /** The contact line's width at a font size: icons, icon gaps, short texts and item gaps. */
    private float contactWidth(List<ContactItem> items, float size) throws IOException {
        float sum = CONTACT_GAP * Math.max(0, items.size() - 1);
        for (ContactItem item : items) sum += CONTACT_ICON + CONTACT_ICON_GAP + width(regular, item.shortText(), size);
        return sum;
    }

    /**
     * Contact items in one row with a small icon before each and short links (no "https://",
     * "www.", trailing "/"). Too wide at 9.5pt: the font shrinks in 0.25pt steps down to 8pt
     * (as fitContact in cv-sheet.ts); only if it still doesn't fit do the last items wrap.
     */
    private void contactLine(List<String> texts) throws IOException {
        List<ContactItem> items = new ArrayList<>(texts.stream().map(ClassicCvRenderer::contactItem).toList());
        items.sort(Comparator.comparingInt(item -> item.kind().ordinal()));
        float size = CONTACT_SIZE;
        while (size - CONTACT_STEP >= CONTACT_MIN_SIZE - 0.001f && contactWidth(items, size) > width + 0.5f) size -= CONTACT_STEP;
        float x = MARGIN_X;
        float lineHeight = size * lineFactor;
        ensure(lineHeight);
        for (ContactItem contact : items) {
            Contact kind = contact.kind();
            String item = contact.shortText();
            boolean link = contact.href() != null;
            float textWidth = width(regular, item, size);
            float itemWidth = CONTACT_ICON + CONTACT_ICON_GAP + textWidth;
            if (x > MARGIN_X && x + itemWidth > MARGIN_X + width + 0.5f) {
                y -= lineHeight;
                ensure(lineHeight);
                x = MARGIN_X;
            }
            float baseline = y - size * 0.85f;
            icon(kind, x, baseline - 0.5f, CONTACT_ICON);
            float textX = x + CONTACT_ICON + CONTACT_ICON_GAP;
            draw(item, regular, size, textX, baseline, link ? LINK : INK);
            if (link) underlineAndLink(textX, baseline, textWidth, size, contact.href());
            x += itemWidth + CONTACT_GAP;
        }
        y -= lineHeight;
    }

    /** A thin black full-width line that closes the header, above the summary. */
    private void headerRule() throws IOException {
        gap(3);
        content.setStrokingColor(INK);
        content.setLineWidth(0.6f);
        content.moveTo(MARGIN_X, y);
        content.lineTo(MARGIN_X + width, y);
        content.stroke();
        gap(1);
    }

    /** Wrapped rich text; `justify` spreads every line but the last to the full width. */
    private void paragraph(List<Run> runs, float size, float indent, float hanging, boolean justify) throws IOException {
        float lineHeight = size * (size >= HEADING ? 1.2f : lineFactor);
        List<List<Word>> lines = wrap(runs, size, width - Math.max(indent, hanging));
        for (int i = 0; i < lines.size(); i++) {
            ensure(lineHeight);
            float x = MARGIN_X + (i == 0 ? indent : hanging);
            float available = width - (i == 0 ? indent : hanging);
            List<Word> line = lines.get(i);
            float extra = 0;
            if (justify && i < lines.size() - 1 && line.size() > 1) {
                float used = 0;
                for (Word word : line) used += word.width + word.spaceAfter;
                used -= line.get(line.size() - 1).spaceAfter;
                extra = (available - used) / (line.size() - 1);
            }
            drawLine(line, x, y - size * 0.85f, size, extra);
            y -= lineHeight;
        }
    }

    // ---- Words and lines ----

    private record Word(String text, PDType0Font font, String href, float width, float spaceAfter) {}

    private List<List<Word>> wrap(List<Run> runs, float size, float maxWidth) throws IOException {
        List<Word> words = new ArrayList<>();
        for (Run run : runs) {
            PDType0Font font = run.bold() ? bold : regular;
            float space = width(font, " ", size);
            String[] parts = run.text().split(" ", -1);
            for (int p = 0; p < parts.length; p++) {
                String part = parts[p];
                boolean spaceFollows = p < parts.length - 1;
                if (part.isEmpty()) {
                    // A space at a run border belongs to the word before it.
                    if (spaceFollows && !words.isEmpty()) {
                        Word last = words.remove(words.size() - 1);
                        words.add(new Word(last.text, last.font, last.href, last.width, last.spaceAfter + space));
                    }
                    continue;
                }
                words.add(new Word(part, font, run.href(), width(font, part, size), spaceFollows ? space : 0));
            }
        }
        List<List<Word>> lines = new ArrayList<>();
        List<Word> line = new ArrayList<>();
        float used = 0;
        for (Word word : words) {
            for (Word piece : split(word, size, maxWidth)) {
                float spaceBefore = line.isEmpty() ? 0 : line.get(line.size() - 1).spaceAfter;
                if (!line.isEmpty() && used + spaceBefore + piece.width > maxWidth) {
                    lines.add(line);
                    line = new ArrayList<>();
                    used = 0;
                    spaceBefore = 0;
                }
                line.add(piece);
                used += spaceBefore + piece.width;
            }
        }
        if (!line.isEmpty()) lines.add(line);
        if (lines.isEmpty()) lines.add(List.of());
        return lines;
    }

    /** Splits a word wider than the line at code-point boundaries. */
    private List<Word> split(Word word, float size, float maxWidth) throws IOException {
        if (word.width <= maxWidth) return List.of(word);
        List<Word> pieces = new ArrayList<>();
        String text = word.text;
        int start = 0;
        while (start < text.length()) {
            int end = start;
            float used = 0;
            while (end < text.length()) {
                int cp = text.codePointAt(end);
                float w = width(word.font, new String(Character.toChars(cp)), size);
                if (used + w > maxWidth && end > start) break;
                used += w;
                end += Character.charCount(cp);
            }
            boolean last = end >= text.length();
            pieces.add(new Word(text.substring(start, end), word.font, word.href, used, last ? word.spaceAfter : 0));
            start = end;
        }
        return pieces;
    }

    /** Draws a line, joining neighbouring words of the same style into one text run. */
    private void drawLine(List<Word> line, float x, float baseline, float size, float extra) throws IOException {
        int i = 0;
        while (i < line.size()) {
            Word first = line.get(i);
            StringBuilder text = new StringBuilder(first.text);
            float runWidth = first.width;
            int j = i + 1;
            // Justified lines are drawn word by word so every gap can grow.
            while (extra == 0 && j < line.size() && line.get(j).font == first.font
                    && java.util.Objects.equals(line.get(j).href, first.href)) {
                Word previous = line.get(j - 1);
                text.append(" ".repeat(Math.max(1, Math.round(previous.spaceAfter / width(previous.font, " ", size)))));
                text.append(line.get(j).text);
                runWidth += previous.spaceAfter + line.get(j).width;
                j++;
            }
            draw(text.toString(), first.font, size, x, baseline, first.href != null ? LINK : INK);
            if (first.href != null) underlineAndLink(x, baseline, runWidth, size, first.href);
            Word last = line.get(j - 1);
            x += runWidth + last.spaceAfter + extra;
            i = j;
        }
    }

    private void underlineAndLink(float x, float baseline, float textWidth, float size, String href) throws IOException {
        content.setStrokingColor(LINK);
        content.setLineWidth(0.5f);
        content.moveTo(x, baseline - 1.4f);
        content.lineTo(x + textWidth, baseline - 1.4f);
        content.stroke();
        var annotation = new PDAnnotationLink();
        var border = new PDBorderStyleDictionary();
        border.setWidth(0);
        annotation.setBorderStyle(border);
        annotation.setRectangle(new PDRectangle(x, baseline - size * 0.25f, textWidth, size * 1.1f));
        var action = new PDActionURI();
        action.setURI(href);
        annotation.setAction(action);
        page.getAnnotations().add(annotation);
    }

    // ---- Icons: small vector shapes, so they never end up in the extracted text ----

    private void icon(Contact kind, float x, float baseline, float s) throws IOException {
        float top = baseline + s * 0.82f;
        float bottom = baseline - s * 0.08f;
        float h = top - bottom;
        float cx = x + s / 2;
        content.setStrokingColor(INK);
        content.setNonStrokingColor(INK);
        content.setLineWidth(0.8f);
        switch (kind) {
            case LOCATION -> {
                // A map pin: a circle head that narrows to a point, with a hole.
                float r = s * 0.36f;
                float cy = top - r;
                float k = 0.5523f * r;
                content.moveTo(cx, bottom);
                content.curveTo(cx - r * 0.6f, cy - r * 0.9f, cx - r, cy - k, cx - r, cy);
                content.curveTo(cx - r, cy + k, cx - k, cy + r, cx, cy + r);
                content.curveTo(cx + k, cy + r, cx + r, cy + k, cx + r, cy);
                content.curveTo(cx + r, cy - k, cx + r * 0.6f, cy - r * 0.9f, cx, bottom);
                content.fill();
                content.setNonStrokingColor(Color.WHITE);
                circle(cx, cy, r * 0.4f);
                content.fill();
            }
            case EMAIL -> {
                float ey = bottom + h * 0.12f;
                float eh = h * 0.72f;
                content.addRect(x + 0.4f, ey, s - 0.8f, eh);
                content.stroke();
                content.moveTo(x + 0.4f, ey + eh);
                content.lineTo(cx, ey + eh * 0.4f);
                content.lineTo(x + s - 0.4f, ey + eh);
                content.stroke();
            }
            case PHONE -> {
                float pw = s * 0.56f;
                float px = cx - pw / 2;
                roundRect(px, bottom, pw, h, s * 0.1f);
                content.stroke();
                content.moveTo(cx - pw * 0.18f, bottom + h * 0.14f);
                content.lineTo(cx + pw * 0.18f, bottom + h * 0.14f);
                content.stroke();
            }
            case LINKEDIN -> {
                // A filled rounded square with a white "i" and "n" drawn as shapes.
                roundRect(x, bottom, s, h, s * 0.15f);
                content.fill();
                content.setNonStrokingColor(Color.WHITE);
                float bar = s * 0.15f;
                content.addRect(x + s * 0.2f, bottom + h * 0.18f, bar, h * 0.42f);
                circle(x + s * 0.2f + bar / 2, bottom + h * 0.75f, bar * 0.65f);
                content.addRect(x + s * 0.45f, bottom + h * 0.18f, bar, h * 0.42f);
                content.addRect(x + s * 0.68f, bottom + h * 0.18f, bar, h * 0.3f);
                content.addRect(x + s * 0.45f, bottom + h * 0.48f, s * 0.38f, bar * 0.8f);
                content.fill();
            }
            case GITHUB -> {
                // A filled circle with white code brackets.
                float r = Math.min(s, h) / 2;
                float cy = bottom + h / 2;
                circle(cx, cy, r);
                content.fill();
                content.setStrokingColor(Color.WHITE);
                content.setLineWidth(0.7f);
                content.moveTo(cx - r * 0.2f, cy + r * 0.38f);
                content.lineTo(cx - r * 0.55f, cy);
                content.lineTo(cx - r * 0.2f, cy - r * 0.38f);
                content.moveTo(cx + r * 0.2f, cy + r * 0.38f);
                content.lineTo(cx + r * 0.55f, cy);
                content.lineTo(cx + r * 0.2f, cy - r * 0.38f);
                content.stroke();
            }
            case LINK -> {
                // A globe.
                float r = Math.min(s, h) / 2 - 0.3f;
                float cy = bottom + h / 2;
                circle(cx, cy, r);
                content.moveTo(cx - r, cy);
                content.lineTo(cx + r, cy);
                content.stroke();
                float k = 0.5523f;
                float rx = r * 0.45f;
                content.moveTo(cx, cy + r);
                content.curveTo(cx + rx * k * 1.8f, cy + r, cx + rx, cy + r * k, cx + rx, cy);
                content.curveTo(cx + rx, cy - r * k, cx + rx * k * 1.8f, cy - r, cx, cy - r);
                content.curveTo(cx - rx * k * 1.8f, cy - r, cx - rx, cy - r * k, cx - rx, cy);
                content.curveTo(cx - rx, cy + r * k, cx - rx * k * 1.8f, cy + r, cx, cy + r);
                content.stroke();
            }
        }
        content.setNonStrokingColor(INK);
        content.setStrokingColor(INK);
    }

    private void circle(float cx, float cy, float r) throws IOException {
        float k = 0.5523f * r;
        content.moveTo(cx + r, cy);
        content.curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
        content.curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
        content.curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
        content.curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
        content.closePath();
    }

    private void roundRect(float x, float y0, float w, float h, float r) throws IOException {
        float k = 0.5523f * r;
        content.moveTo(x + r, y0);
        content.lineTo(x + w - r, y0);
        content.curveTo(x + w - r + k, y0, x + w, y0 + r - k, x + w, y0 + r);
        content.lineTo(x + w, y0 + h - r);
        content.curveTo(x + w, y0 + h - r + k, x + w - r + k, y0 + h, x + w - r, y0 + h);
        content.lineTo(x + r, y0 + h);
        content.curveTo(x + r - k, y0 + h, x, y0 + h - r + k, x, y0 + h - r);
        content.lineTo(x, y0 + r);
        content.curveTo(x, y0 + r - k, x + r - k, y0, x + r, y0);
        content.closePath();
    }

    // ---- Low level ----

    private void draw(String text, PDType0Font font, float size, float x, float baseline, Color color) throws IOException {
        if (text.isEmpty()) return;
        content.setNonStrokingColor(color);
        content.beginText();
        content.setFont(font, size);
        content.newLineAtOffset(x, baseline);
        content.showText(text);
        content.endText();
    }

    private static float width(PDType0Font font, String text, float size) throws IOException {
        try {
            return font.getStringWidth(text) / 1000 * size;
        } catch (IllegalArgumentException exception) {
            throw new PdfExportService.UnsupportedCharacterException();
        }
    }

    /** Vertical space, smaller at the tighter fit steps. */
    private void gap(float points) {
        y -= points * gaps;
    }

    private void ensure(float height) throws IOException {
        if (y - height < MARGIN_Y) newPage();
    }

    private void newPage() throws IOException {
        if (content != null) content.close();
        page = new PDPage(PDRectangle.A4);
        document.addPage(page);
        content = new PDPageContentStream(document, page);
        y = page.getMediaBox().getHeight() - MARGIN_Y;
    }
}
