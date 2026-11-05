package com.rayen.backend;

import java.net.http.HttpResponse;
import java.util.concurrent.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ApplicationIntegrationTests {
    @LocalServerPort int port;

    // Create a complete synthetic application with no real personal documents.
    static Map<String, Object> input() {
        return new HashMap<>(Map.of("jobTitle", "Developer", "company", "Example", "language", "German",
            "sourceCv", "Synthetic source Grüße", "jobDescription", "Synthetic vacancy", "includeLetter", true,
            "motivation", "Synthetic reason", "editedCv", "Latest edited CV", "editedLetter", "Latest edited letter", "demo", true));
    }

    // Register and sign in through real HTTP security filters.
    static AccountIntegrationTests.BrowserClient signedIn(int port) throws Exception {
        var client = new AccountIntegrationTests.BrowserClient(port);
        client.csrf();
        String email = UUID.randomUUID() + "@example.test";
        assertEquals(201, client.register(email, AccountIntegrationTests.PASSWORD).statusCode());
        assertEquals(200, client.login(email, AccountIntegrationTests.PASSWORD).statusCode());
        client.csrf();
        return client;
    }

    // Exercise create, paginated metadata, reopen, versioned update and delete.
    @Test
    void lifecyclePreservesDocumentsAndRejectsStaleUpdatesAndDeletes() throws Exception {
        var client = signedIn(port);
        var payload = input();
        payload.put("userId", -1); // An injected owner is ignored; the session still owns the row.
        var created = client.json("/api/applications", payload);
        assertEquals(201, created.statusCode());
        var draft = client.json.readTree(created.body());
        String path = "/api/applications/" + draft.get("id").asText();
        assertEquals(0, draft.get("version").asLong());
        assertNotNull(draft.get("createdAt"));
        assertEquals("Latest edited letter", draft.get("editedLetter").asText());
        assertEquals(200, client.get(path).statusCode());
        var list = client.json.readTree(client.get("/api/applications?page=0&size=1").body());
        assertEquals(1, list.get("items").size());
        assertEquals(1, list.get("total").asLong());
        assertFalse(list.get("items").get(0).has("sourceCv"));
        assertFalse(list.get("items").get(0).has("editedCv"));
        assertEquals(0, client.json.readTree(client.get("/api/applications?page=1&size=1").body()).get("items").size());
        payload.put("version", 0);
        payload.put("editedCv", "Newest unsanitized plain text <b>Grüße</b>");
        var updated = send(client, "PUT", path, payload);
        assertEquals(200, updated.statusCode());
        assertEquals(1, client.json.readTree(updated.body()).get("version").asLong());
        assertEquals(draft.get("createdAt").asText(), client.json.readTree(updated.body()).get("createdAt").asText());
        assertEquals(409, send(client, "PUT", path, payload).statusCode());
        assertEquals(409, send(client, "DELETE", path + "?version=0", Map.of()).statusCode());
        assertEquals(payload.get("editedCv"), client.json.readTree(client.get(path).body()).get("editedCv").asText());
        assertEquals(204, send(client, "DELETE", path + "?version=1", Map.of()).statusCode());
        assertEquals(404, client.get(path).statusCode());
        assertEquals(0, client.json.readTree(client.get("/api/applications").body()).get("total").asLong());
    }

    // Directly substitute another account's ID on all record endpoints.
    @Test
    void ownershipAndAuthenticationApplyToEveryOperation() throws Exception {
        var owner = signedIn(port);
        String id = owner.json.readTree(owner.json("/api/applications", input()).body()).get("id").asText();
        String path = "/api/applications/" + id;
        var attacker = signedIn(port);
        var payload = input(); payload.put("version", 0);
        assertEquals(0, attacker.json.readTree(attacker.get("/api/applications").body()).get("total").asLong());
        assertEquals(404, attacker.get(path).statusCode());
        assertEquals(404, send(attacker, "PUT", path, payload).statusCode());
        assertEquals(404, send(attacker, "DELETE", path + "?version=0", Map.of()).statusCode());
        assertEquals(200, owner.get(path).statusCode());
        var anonymous = new AccountIntegrationTests.BrowserClient(port); anonymous.csrf();
        assertEquals(401, anonymous.get("/api/applications").statusCode());
        assertEquals(401, anonymous.get(path).statusCode());
        assertEquals(401, anonymous.json("/api/applications", input()).statusCode());
        assertEquals(401, send(anonymous, "PUT", path, payload).statusCode());
        assertEquals(401, send(anonymous, "DELETE", path + "?version=0", Map.of()).statusCode());
        assertEquals(403, owner.send("POST", "/api/applications", "{}", "application/json", null).statusCode());
    }

    // Check limits, required values, optional documents and pagination bounds.
    @Test
    void validatesPayloadsWithoutReflectingPrivateContent() throws Exception {
        var client = signedIn(port);
        for (var entry : Map.<String, Object>of("jobTitle", "x".repeat(151), "company", " ", "language", "French",
                "sourceCv", "x".repeat(30001), "jobDescription", "", "motivation", "x".repeat(3001),
                "editedCv", "x".repeat(60001), "editedLetter", "x".repeat(60001), "demo", false).entrySet()) {
            var payload = input(); payload.put(entry.getKey(), entry.getValue());
            var response = client.json("/api/applications", payload);
            assertEquals(400, response.statusCode(), entry.getKey());
            assertFalse(response.body().contains("Synthetic source"));
        }
        var payload = input(); payload.put("motivation", " ");
        assertEquals(400, client.json("/api/applications", payload).statusCode());
        payload = input(); payload.put("includeLetter", null);
        assertEquals(400, client.json("/api/applications", payload).statusCode());
        payload = input(); payload.put("includeLetter", false); payload.put("motivation", ""); payload.put("editedLetter", null); payload.put("editedCv", "");
        var created = client.json("/api/applications", payload);
        assertEquals(201, created.statusCode());
        String path = "/api/applications/" + client.json.readTree(created.body()).get("id").asText();
        assertEquals(400, send(client, "PUT", path, payload).statusCode());
        payload.put("version", -1);
        assertEquals(400, send(client, "PUT", path, payload).statusCode());
        for (String query : List.of("page=-1", "size=0", "size=101", "page=1000001", "size=oops")) {
            assertEquals(400, client.get("/api/applications?" + query).statusCode());
        }
        assertEquals(400, client.get("/api/applications/not-a-uuid").statusCode());
        assertEquals(400, send(client, "DELETE", path, Map.of()).statusCode());
        assertEquals(400, send(client, "DELETE", path + "?version=-1", Map.of()).statusCode());
    }

    // Race two writers against one version and require exactly one successful write.
    @Test
    void simultaneousEditorsCannotSilentlyOverwriteEachOther() throws Exception {
        var client = signedIn(port);
        String path = "/api/applications/" + client.json.readTree(client.json("/api/applications", input()).body()).get("id").asText();
        var left = input(); left.put("version", 0); left.put("editedCv", "Left edit");
        var right = input(); right.put("version", 0); right.put("editedCv", "Right edit");
        try (var executor = Executors.newFixedThreadPool(2)) {
            var gate = new CountDownLatch(1);
            var first = executor.submit(() -> { gate.await(); return send(client, "PUT", path, left); });
            var second = executor.submit(() -> { gate.await(); return send(client, "PUT", path, right); });
            gate.countDown();
            var statuses = new ArrayList<>(List.of(first.get(10, TimeUnit.SECONDS).statusCode(), second.get(10, TimeUnit.SECONDS).statusCode()));
            Collections.sort(statuses);
            assertEquals(List.of(200, 409), statuses);
        }
        assertEquals(1, client.json.readTree(client.get(path).body()).get("version").asLong());
    }

    // Send versioned mutations through the same cookie and CSRF contract as Angular.
    static HttpResponse<String> send(AccountIntegrationTests.BrowserClient client, String method, String path, Map<String, ?> body) throws Exception {
        return client.send(method, path, client.json.writeValueAsString(body), "application/json", client.token());
    }
}
