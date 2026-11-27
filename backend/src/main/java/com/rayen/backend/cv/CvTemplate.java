package com.rayen.backend.cv;

import java.util.Locale;

/**
 * The CV templates a CV can be saved with. The layouts live only in the frontend's CvSheet, which
 * draws the preview and is printed for the PDF export; the ids match cv-templates.ts and the check
 * constraint on cvs.template (V5 migration).
 */
public enum CvTemplate {
    CLASSIC, SIMPLE, MODERN, COMPACT, CREATIVE;

    /** For @Pattern validation of request fields. */
    public static final String IDS = "classic|simple|modern|compact|creative";

    public String id() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** Null or unknown ids fall back to CLASSIC, the default (request fields are validated before this). */
    public static CvTemplate of(String id) {
        if (id == null) return CLASSIC;
        try {
            return valueOf(id.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return CLASSIC;
        }
    }
}
