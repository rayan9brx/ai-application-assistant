package com.rayen.backend;

import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Runs the Upload → Score → Fix → Tailor flow over real HTTP (no accounts, nothing stored),
 * against a fake Claude server so no API key or network access is needed.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {"ANTHROPIC_API_KEY=test-key", "app.rate-limit.ai-per-10-min=1000"})
class CvAiIntegrationTests {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Deque<Object[]> RESPONSES = new ArrayDeque<>();
    private static final List<JsonNode> REQUESTS = new java.util.concurrent.CopyOnWriteArrayList<>();
    private static final List<Map<String, String>> HEADERS = new java.util.concurrent.CopyOnWriteArrayList<>();
    private static final HttpServer CLAUDE = fakeClaude();

    @LocalServerPort private int port;

    static final String CV = "Taylor Brooks\ntaylor@example.com\n\nExperience\nFrontend Developer, Northwind Labs\n"
        + "- Responsible for   website updates\n\nSkills\nReact, TypeScript";

    @DynamicPropertySource
    static void claudeUrl(DynamicPropertyRegistry registry) {
        registry.add("app.ai.base-url", () -> "http://127.0.0.1:" + CLAUDE.getAddress().getPort());
        registry.add("app.ai.timeout-seconds", () -> "5");
    }

    @AfterAll
    static void stop() { CLAUDE.stop(0); }

    @BeforeEach
    void reset() {
        RESPONSES.clear();
        REQUESTS.clear();
        HEADERS.clear();
    }

    private static HttpServer fakeClaude() {
        try {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/v1/messages", exchange -> {
                REQUESTS.add(JSON.readTree(exchange.getRequestBody().readAllBytes()));
                HEADERS.add(Map.of("key", String.valueOf(exchange.getRequestHeaders().getFirst("x-api-key")),
                    "version", String.valueOf(exchange.getRequestHeaders().getFirst("anthropic-version"))));
                Object[] next = RESPONSES.isEmpty() ? new Object[] {500, "{}"} : RESPONSES.poll();
                byte[] body = ((String) next[1]).getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders((int) next[0], body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            server.start();
            return server;
        } catch (java.io.IOException exception) {
            throw new IllegalStateException(exception);
        }
    }

    /** Queues a successful Messages API reply whose text block is `answer` serialized as JSON. */
    private static void reply(Object answer) {
        reply(200, Map.of("stop_reason", "end_turn", "content",
            List.of(Map.of("type", "thinking", "thinking", ""), Map.of("type", "text", "text", JSON.writeValueAsString(answer)))));
    }

    private static void reply(int status, Object body) {
        RESPONSES.add(new Object[] {status, JSON.writeValueAsString(body)});
    }

    private static Map<String, Object> field(boolean detected, String detail) {
        return Map.of("detected", detected, "detail", detail);
    }

    private static Map<String, Object> score(int overall) {
        return Map.of("overall", overall,
            "categories", Map.of("content", 50, "format", 70, "optimization", 40, "bestPractices", 60, "applicationReady", 45),
            "fields", Map.of("name", field(true, "Detected"), "contact", field(true, "Email only"),
                "experience", field(true, "1 position detected"), "education", field(false, "No education section"),
                "skills", field(true, "Detected")),
            "jobMatch", Map.of("matchPercent", 47, "matchedKeywords", List.of("React", "React", "TypeScript"),
                "missingKeywords", List.of("CI/CD")),
            "issues", List.of(Map.of("section", "Experience", "problem", "Duties instead of results.",
                "suggestion", "Describe what changed because of your work.", "severity", "high")));
    }

    private static final java.net.http.HttpClient HTTP = java.net.http.HttpClient.newHttpClient();

    private java.net.http.HttpResponse<String> send(String path, String contentType, byte[] body) throws Exception {
        return HTTP.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:" + port + path))
            .header("Content-Type", contentType).POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(body)).build(),
            java.net.http.HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponseFacade post(String path, Object body) throws Exception {
        var response = send(path, "application/json", JSON.writeValueAsBytes(body));
        return new HttpResponseFacade(response.statusCode(), response.body());
    }

    record HttpResponseFacade(int status, String body) {
        JsonNode json() { return JSON.readTree(body); }
    }

    @Test
    void scoresAnonymouslyWithStructuredOutputAndServerSideKey() throws Exception {
        reply(score(58));
        var response = post("/api/cv/score", Map.of("cvText", CV, "jobDescription", "We need React and CI/CD."));
        assertEquals(200, response.status(), response.body());
        JsonNode result = response.json();
        assertEquals(58, result.path("overall").asInt());
        assertEquals("Needs improvement", result.path("label").asString());
        assertEquals(47, result.path("jobMatch").path("matchPercent").asInt());
        assertEquals(2, result.path("jobMatch").path("matchedKeywords").size(), "duplicates removed");
        assertFalse(result.path("fields").path("education").path("detected").asBoolean());

        JsonNode sent = REQUESTS.getFirst();
        assertEquals("claude-opus-5-5", sent.path("model").asString());
        assertEquals("json_schema", sent.path("output_config").path("format").path("type").asString());
        assertEquals("default", sent.path("fallbacks").asString());
        assertTrue(sent.path("messages").get(0).path("content").asString().contains("<cv>\n" + CV));
        assertEquals("test-key", HEADERS.getFirst().get("key"));
        assertEquals("2026-10-21", HEADERS.getFirst().get("version"));
    }

    @Test
    void dropsJobMatchWithoutJobDescriptionAndRetriesInvalidAnswersOnce() throws Exception {
        reply(Map.of("overall", 140));          // out of range: rejected and retried
        reply(score(85));
        var response = post("/api/cv/score", Map.of("cvText", CV));
        assertEquals(200, response.status(), response.body());
        assertEquals("Excellent", response.json().path("label").asString());
        assertTrue(response.json().path("jobMatch").isMissingNode());
        assertEquals(2, REQUESTS.size());

        reply(Map.of("nonsense", true));
        reply(Map.of("nonsense", true));
        var failed = post("/api/cv/score", Map.of("cvText", CV));
        assertEquals(502, failed.status());
        assertTrue(failed.json().path("message").asString().contains("unexpected result"));
    }

    @Test
    void reportsRefusalsOverloadAndBadInputWithSafeMessages() throws Exception {
        reply(200, Map.of("stop_reason", "refusal", "content", List.of()));
        assertEquals(422, post("/api/cv/score", Map.of("cvText", CV)).status());

        reply(529, Map.of("type", "error"));
        reply(529, Map.of("type", "error"));
        var busy = post("/api/cv/score", Map.of("cvText", CV));
        assertEquals(503, busy.status());
        assertTrue(busy.json().path("message").asString().contains("busy"));

        var invalid = post("/api/cv/score", Map.of("cvText", "x".repeat(30001)));
        assertEquals(400, invalid.status());
        assertFalse(invalid.body().contains("xxxx"), "never echoes CV text");
    }

    @Test
    void fixLocatesTheOriginalLineEvenWithDifferentSpacing() throws Exception {
        reply(Map.of("original", "- Responsible for website updates",
            "replacement", "- Redesigned the company website, improving [add result, e.g. load time by 20%]",
            "explanation", "Shows impact.", "needsUserInput", true));
        var response = post("/api/cv/fix", Map.of("cvText", CV, "issue",
            Map.of("section", "Experience", "problem", "Duties.", "suggestion", "Show results.")));
        assertEquals(200, response.status(), response.body());
        assertTrue(response.json().path("found").asBoolean());
        assertEquals("- Responsible for   website updates", response.json().path("original").asString());
        assertTrue(response.json().path("needsUserInput").asBoolean());
    }

    @Test
    void tailorKeepsOnlyChangesThatCanBeApplied() throws Exception {
        reply(Map.of("changes", List.of(
                Map.of("section", "Skills", "original", "React, TypeScript", "replacement", "TypeScript, React",
                    "reason", "Leads with the job's main language."),
                Map.of("section", "Experience", "original", "Invented line", "replacement", "x", "reason", "y")),
            "notes", List.of("The job asks for CI/CD; add it only if you have used it.")));
        var response = post("/api/cv/tailor", Map.of("cvText", CV, "jobDescription", "TypeScript, CI/CD"));
        assertEquals(200, response.status(), response.body());
        assertEquals(1, response.json().path("changes").size());
        assertEquals(1, response.json().path("notes").size());
        assertEquals(400, post("/api/cv/tailor", Map.of("cvText", CV)).status(), "job description required");
    }

    @Test
    void extractsDocxAnonymouslyAndRejectsEntityTricks() throws Exception {
        String ok = "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>"
            + "<w:p><w:r><w:t>Taylor Brooks</w:t></w:r></w:p><w:p><w:r><w:t>Frontend</w:t><w:tab/><w:t>Developer</w:t></w:r></w:p>"
            + "</w:body></w:document>";
        var response = upload(docx(ok));
        assertEquals(200, response.statusCode(), response.body());
        assertEquals("Taylor Brooks\nFrontend\tDeveloper", JSON.readTree(response.body()).path("text").asString());

        String xxe = "<?xml version=\"1.0\"?><!DOCTYPE d [<!ENTITY x SYSTEM \"file:///etc/hostname\">]>"
            + "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>&x;</w:t></w:r></w:p></w:body></w:document>";
        var rejected = upload(docx(xxe));
        assertNotEquals(200, rejected.statusCode());
    }

    // Exercise real servlet multipart limits, which MockMvc does not enforce.
    @Test
    void oversizedUploadsGetAStructuredError() throws Exception {
        for (int size : new int[] {5 * 1024 * 1024 + 1, 6 * 1024 * 1024 + 1}) {
            var response = upload(new byte[size]);
            assertEquals(413, response.statusCode());
            assertTrue(response.body().contains("FILE_TOO_LARGE"));
        }
    }

    @Test
    void unknownRoutesAndMethodsAreNotServed() throws Exception {
        assertEquals(404, post("/api/applications", Map.of()).status());
        assertEquals(404, post("/api/auth/login", Map.of()).status());
        var get = HTTP.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:" + port + "/api/cv/score")).GET().build(),
            java.net.http.HttpResponse.BodyHandlers.ofString());
        assertEquals(405, get.statusCode());
    }

    private java.net.http.HttpResponse<String> upload(byte[] file) throws Exception {
        String head = "--b\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cv.docx\"\r\nContent-Type: application/octet-stream\r\n\r\n";
        var body = new ByteArrayOutputStream();
        body.write(head.getBytes(StandardCharsets.ISO_8859_1));
        body.write(file);
        body.write("\r\n--b--\r\n".getBytes(StandardCharsets.ISO_8859_1));
        return send("/api/cv/extract", "multipart/form-data; boundary=b", body.toByteArray());
    }

    static byte[] docx(String documentXml) throws Exception {
        var bytes = new ByteArrayOutputStream();
        try (var zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("[Content_Types].xml"));
            zip.write("<Types/>".getBytes(StandardCharsets.UTF_8));
            zip.putNextEntry(new ZipEntry("word/document.xml"));
            zip.write(documentXml.getBytes(StandardCharsets.UTF_8));
        }
        return bytes.toByteArray();
    }
}
