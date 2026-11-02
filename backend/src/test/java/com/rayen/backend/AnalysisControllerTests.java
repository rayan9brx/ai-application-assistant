package com.rayen.backend;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.MediaType;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AnalysisControllerTests {
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new AnalysisController(), new HealthController()).build();

    // Exercise JSON validation and both template languages through the HTTP endpoint.
    @Test
    void previewsPreserveCvAndOnlyIncludeRequestedLetter() throws Exception {
        for (String language : new String[]{"English", "German"}) {
            for (boolean letter : new boolean[]{false, true}) {
                mvc.perform(post("/api/analyze").contentType(MediaType.APPLICATION_JSON)
                    .content(payload(language, letter, "My own reason")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.demo").value(true))
                    .andExpect(jsonPath("$.cvDraft").value("  Original CV\n<text>  "))
                    .andExpect(jsonPath("$.notice").value(org.hamcrest.Matchers.containsString("no AI")))
                    .andExpect(letter
                        ? jsonPath("$.motivationLetterDraft").value(org.hamcrest.Matchers.containsString(language.equals("German") ? "DEMO-VORLAGE" : "DEMO TEMPLATE"))
                        : jsonPath("$.motivationLetterDraft").doesNotExist());
            }
        }
    }

    // Reject invalid sources and allow absent motivation when no letter is requested.
    @Test
    void validatesRequiredFieldsLengthsAndConditionalMotivation() throws Exception {
        String valid = payload("English", false, "");
        mvc.perform(post("/api/analyze").contentType(MediaType.APPLICATION_JSON).content(valid)).andExpect(status().isOk());
        String[] invalid = {
            payload("French", false, ""), payload("English", true, "  "),
            valid.replace("Developer", " "), valid.replace("Example Ltd", ""),
            valid.replace("Vacancy", "x".repeat(30001)),
            valid.replace("Developer", "x".repeat(151)),
            valid.replace("Example Ltd", "x".repeat(151)),
            valid.replace("Original CV", "x".repeat(30001)),
            valid.replace("Vacancy", " "), valid.replace("  Original CV\\n<text>  ", ""),
            payload("English", false, "x".repeat(3001)),
            "{}", "{\"includeLetter\":true}"
        };
        for (String body : invalid) {
            mvc.perform(post("/api/analyze").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
    }

    // Build controlled request fixtures without using personal data.
    private String payload(String language, boolean letter, String motivation) {
        return "{\"cvText\":\"  Original CV\\n<text>  \",\"jobText\":\"Vacancy\",\"jobTitle\":\"Developer\","
            + "\"company\":\"Example Ltd\",\"language\":\"" + language + "\",\"includeLetter\":" + letter
            + ",\"motivation\":\"" + motivation + "\"}";
    }
}
