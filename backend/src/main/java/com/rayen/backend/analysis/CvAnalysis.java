package com.rayen.backend.analysis;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** Result types for the CV endpoints. Every value is validated before it leaves the server. */
public final class CvAnalysis {
    private CvAnalysis() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Score(int overall, String label, Categories categories, Fields fields,
                        JobMatch jobMatch, List<Issue> issues) {}

    public record Categories(int content, int format, int optimization, int bestPractices, int applicationReady) {}

    public record Field(boolean detected, String detail) {}

    public record Fields(Field name, Field contact, Field experience, Field education, Field skills) {}

    public record JobMatch(int matchPercent, List<String> matchedKeywords, List<String> missingKeywords) {}

    public record Issue(String section, String problem, String suggestion, String severity) {}

    /** `found` says whether `original` occurs verbatim in the submitted CV text. */
    public record Fix(String original, String replacement, String explanation, boolean needsUserInput, boolean found) {}

    public record Change(String section, String original, String replacement, String reason) {}

    public record Tailoring(List<Change> changes, List<String> notes) {}

    /** missingKeywords are shown as "Missing, add only if true"; they are never added to the CV. */
    public record JobTailoring(String company, String jobTitle, int matchBefore, int matchAfter,
                               List<String> matchedKeywords, List<String> missingKeywords,
                               List<Change> changes, List<String> notes) {}

    static String label(int overall) {
        return overall >= 80 ? "Excellent" : overall >= 60 ? "Good" : "Needs improvement";
    }
}
