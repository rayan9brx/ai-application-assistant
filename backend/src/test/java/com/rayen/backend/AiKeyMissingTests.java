package com.rayen.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Without ANTHROPIC_API_KEY the app still starts; only the AI endpoints fail, with a clear message. */
@SpringBootTest(properties = {"ANTHROPIC_API_KEY=", "app.rate-limit.ai-per-10-min=1000"})
class AiKeyMissingTests {
    private static final String MESSAGE =
        "AI features aren't set up on this server yet. Ask the site owner to configure ANTHROPIC_API_KEY.";
    private static final String CV = "\"Taylor Brooks\\nFrontend Developer\\nSkills: React, TypeScript\"";

    @Autowired private WebApplicationContext context;

    private void expectNotSetUp(String path, String body) throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.message").value(MESSAGE));
    }

    @Test
    void aiEndpointsExplainThatTheKeyIsMissing() throws Exception {
        expectNotSetUp("/api/cv/score", "{\"cvText\":" + CV + "}");
        expectNotSetUp("/api/cv/fix", "{\"cvText\":" + CV + ",\"issue\":{\"section\":\"Skills\","
            + "\"problem\":\"Too short\",\"suggestion\":\"Add more\"}}");
        expectNotSetUp("/api/cv/tailor", "{\"cvText\":" + CV + ",\"jobDescription\":\"React developer\"}");
    }

    @Test
    void healthStillWorks() throws Exception {
        MockMvcBuilders.webAppContextSetup(context).build()
            .perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/health"))
            .andExpect(status().isOk());
    }
}
