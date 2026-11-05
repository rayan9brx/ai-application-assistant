package com.rayen.backend;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import static org.junit.jupiter.api.Assertions.*;

class ApplicationRestartTests {
    // Close and recreate the entire backend against a real disposable PostgreSQL database.
    @Test
    @EnabledIfEnvironmentVariable(named="TEST_DB_URL", matches="jdbc:postgresql:.*")
    void draftSurvivesBackendRestartAndOwnerCanSignInAgain() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        String id;
        try (var first = start()) {
            var client = new AccountIntegrationTests.BrowserClient(((WebServerApplicationContext) first).getWebServer().getPort());
            client.csrf();
            assertEquals(201, client.register(email, AccountIntegrationTests.PASSWORD).statusCode());
            assertEquals(200, client.login(email, AccountIntegrationTests.PASSWORD).statusCode()); client.csrf();
            var response = client.json("/api/applications", ApplicationIntegrationTests.input());
            assertEquals(201, response.statusCode());
            id = client.json.readTree(response.body()).get("id").asText();
            var update = ApplicationIntegrationTests.input();
            update.put("version", 0); update.put("editedCv", "Edited immediately before restart");
            assertEquals(200, ApplicationIntegrationTests.send(client, "PUT", "/api/applications/" + id, update).statusCode());
        }
        try (var second = start()) {
            var client = new AccountIntegrationTests.BrowserClient(((WebServerApplicationContext) second).getWebServer().getPort());
            assertEquals(401, client.get("/api/applications/" + id).statusCode());
            client.csrf();
            assertEquals(200, client.login(email, AccountIntegrationTests.PASSWORD).statusCode()); client.csrf();
            var reopened = client.get("/api/applications/" + id);
            assertEquals(200, reopened.statusCode());
            assertEquals("Edited immediately before restart", client.json.readTree(reopened.body()).get("editedCv").asText());
            assertEquals("Latest edited letter", client.json.readTree(reopened.body()).get("editedLetter").asText());
            assertEquals(1, client.json.readTree(reopened.body()).get("version").asLong());
        }
    }

    // Bind a fresh HTTP server while retaining the environment's dedicated test datasource.
    private ConfigurableApplicationContext start() {
        return new SpringApplicationBuilder(BackendApplication.class)
            .profiles("test").properties("server.port=0").run();
    }
}
