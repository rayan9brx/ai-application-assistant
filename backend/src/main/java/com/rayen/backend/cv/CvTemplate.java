package com.rayen.backend.cv;

import java.util.Locale;

/**
 * The CV templates of the PDF export. Every template stays ATS-friendly: one column of real,
 * selectable text, standard section headings, and no tables or images for content. They only
 * differ in sizes, spacing and where the accent colour is used. The ids match the frontend's
 * cv-templates.ts and the check constraint on cvs.template (V5 migration).
 *
 * @param margin       page margin in points
 * @param nameSize     the name on the first line
 * @param bodySize     paragraphs and bullets
 * @param headingSize  section headings
 * @param spacing      extra line spacing, as a share of the font size
 * @param sectionGap   space above a section heading
 * @param accentName   name in the accent colour
 * @param accentHeads  headings (and bullets) in the accent colour
 * @param rule         a line under each heading
 * @param topBar       the name and contact lines sit in a coloured bar across the top
 */
public enum CvTemplate {
    SIMPLE(50, 20, 10.5f, 11.5f, 0.15f, 10, false, false, true, false),
    MODERN(50, 24, 10.5f, 11f, 0.18f, 12, true, true, true, false),
    COMPACT(36, 17, 9.5f, 10f, 0.05f, 6, false, false, true, false),
    CREATIVE(50, 24, 10.5f, 11f, 0.18f, 12, false, true, false, true);

    /** For @Pattern validation of request fields. */
    public static final String IDS = "simple|modern|compact|creative";

    final float margin;
    final float nameSize;
    final float bodySize;
    final float headingSize;
    final float spacing;
    final float sectionGap;
    final boolean accentName;
    final boolean accentHeads;
    final boolean rule;
    final boolean topBar;

    CvTemplate(float margin, float nameSize, float bodySize, float headingSize, float spacing, float sectionGap,
               boolean accentName, boolean accentHeads, boolean rule, boolean topBar) {
        this.margin = margin;
        this.nameSize = nameSize;
        this.bodySize = bodySize;
        this.headingSize = headingSize;
        this.spacing = spacing;
        this.sectionGap = sectionGap;
        this.accentName = accentName;
        this.accentHeads = accentHeads;
        this.rule = rule;
        this.topBar = topBar;
    }

    public String id() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** Null or unknown ids fall back to SIMPLE (request fields are validated before this). */
    public static CvTemplate of(String id) {
        if (id == null) return SIMPLE;
        try {
            return valueOf(id.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return SIMPLE;
        }
    }
}
