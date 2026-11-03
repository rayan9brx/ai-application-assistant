package com.rayen.backend;

import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AccountIntegrationTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    static final String PASSWORD = "Test-only Grüße password 123!";

    // Register against the actual servlet filters and verify persistence and uniqueness.
    @Test
    void registrationValidatesAndHashesPasswordsAndEnforcesUniqueNormalizedEmail() throws Exception {
        var client = new BrowserClient(port);
        client.csrf();
        String email = UUID.randomUUID() + "@example.test";
        assertEquals(201, client.register(email.toUpperCase(Locale.ROOT), PASSWORD).statusCode());
        String hash = jdbc.queryForObject("SELECT password_hash FROM app_user WHERE email = ?", String.class, email);
        assertNotEquals(PASSWORD, hash);
        assertTrue(hash.startsWith("{pbkdf2-v5_8}"));
        assertTrue(encoder.matches(PASSWORD, hash));
        assertEquals(409, client.register(email, PASSWORD).statusCode());
        assertEquals(400, client.register("invalid", PASSWORD).statusCode());
        assertEquals(400, client.register(UUID.randomUUID() + "@example.test", "short").statusCode());
        assertEquals(400, client.register(email, " ".repeat(12)).statusCode());
        assertEquals(400, client.register(email, "x".repeat(129)).statusCode());
    }

    // Compare failures for unknown users and wrong passwords, then exercise a real session.
    @Test
    void loginUsesGenericErrorsRotatesCsrfAndLogoutInvalidatesSession() throws Exception {
        var client = new BrowserClient(port);
        client.csrf();
        String email = UUID.randomUUID() + "@example.test";
        assertEquals(201, client.register(email, PASSWORD).statusCode());
        var wrong = client.login(email, "incorrect");
        var unknown = client.login("missing@example.test", "incorrect");
        assertEquals(401, wrong.statusCode());
        assertEquals(wrong.body(), unknown.body());
        assertFalse(wrong.body().contains(email));
        String oldToken = client.token();
        var login = client.login("  " + email.toUpperCase(Locale.ROOT) + "  ", PASSWORD);
        assertEquals(200, login.statusCode());
        String sessionHeader = login.headers().allValues("set-cookie").stream()
            .filter(value -> value.startsWith("JSESSIONID=")).findFirst().orElseThrow();
        assertTrue(sessionHeader.toLowerCase(Locale.ROOT).contains("httponly"));
        assertTrue(sessionHeader.toLowerCase(Locale.ROOT).contains("samesite=lax"));
        client.csrf();
        assertNotEquals(oldToken, client.token());
        assertEquals(200, client.get("/api/auth/me").statusCode());
        assertTrue(client.get("/api/auth/me").body().contains(email));
        var preview = client.json("/api/analyze", Map.of("cvText", "CV Grüße", "jobText", "Job", "jobTitle", "Developer", "company", "Müller", "language", "German", "includeLetter", false));
        assertEquals(200, preview.statusCode());
        assertTrue(preview.body().contains("CV Grüße"));
        assertEquals(200, client.json("/api/documents/export", Map.of("documentType", "cv", "text", "Latest edit Grüße")).statusCode());
        byte[] pdf = new PdfExportService().generate("Authenticated upload Grüße");
        var multipart = new java.io.ByteArrayOutputStream();
        multipart.write("--account-test\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cv.pdf\"\r\nContent-Type: application/pdf\r\n\r\n".getBytes(StandardCharsets.UTF_8));
        multipart.write(pdf);
        multipart.write("\r\n--account-test--\r\n".getBytes(StandardCharsets.UTF_8));
        var uploaded = client.http.send(HttpRequest.newBuilder(URI.create(client.base + "/api/cv/extract"))
            .header("Content-Type", "multipart/form-data; boundary=account-test")
            .header("X-XSRF-TOKEN", client.token()).POST(HttpRequest.BodyPublishers.ofByteArray(multipart.toByteArray()))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, uploaded.statusCode());
        assertTrue(uploaded.body().contains("Authenticated upload Grüße"));
        assertEquals(403, client.send("POST", "/api/auth/logout", "{}", "application/json", "invalid").statusCode());
        assertEquals(200, client.get("/api/auth/me").statusCode());
        assertEquals(200, client.json("/api/auth/logout", Map.of()).statusCode());
        assertEquals(401, client.get("/api/auth/me").statusCode());
        client.csrf();
        assertEquals(401, client.json("/api/documents/export", Map.of("documentType", "cv", "text", "CV")).statusCode());
        assertEquals(200, client.login(email, PASSWORD).statusCode());
        client.csrf();
        assertEquals(200, client.get("/api/auth/me").statusCode());
    }

    // Missing and forged tokens fail even on public auth routes; valid tokens do not grant login.
    @Test
    void csrfAndAuthenticationProtectEveryDocumentEndpoint() throws Exception {
        var client = new BrowserClient(port);
        for (String path : List.of("/api/auth/register", "/api/auth/login", "/api/auth/logout", "/api/analyze", "/api/cv/extract", "/api/documents/export")) {
            assertEquals(403, client.send("POST", path, "{}", "application/json", null).statusCode(), path);
        }
        client.csrf();
        for (String path : List.of("/api/analyze", "/api/cv/extract", "/api/documents/export")) {
            assertEquals(403, client.send("POST", path, "{}", "application/json", "forged").statusCode(), path);
            assertEquals(401, client.json(path, Map.of()).statusCode(), path);
        }
        assertEquals(401, client.get("/api/auth/me").statusCode());
        assertEquals(200, client.get("/api/health").statusCode());
    }

    static class BrowserClient {
        final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        final HttpClient http = HttpClient.newBuilder().cookieHandler(cookies).build();
        final String base;
        final JsonMapper json = JsonMapper.builder().build();

        // Give each test an independent browser-like cookie jar.
        BrowserClient(int port) { base = "http://localhost:" + port; }

        // Trigger the server's SPA token cookie without bypassing the security filters.
        void csrf() throws Exception { assertEquals(200, get("/api/auth/csrf").statusCode()); }

        // Read the raw cookie as Angular's XSRF interceptor does.
        String token() {
            return cookies.getCookieStore().getCookies().stream().filter(c -> c.getName().equals("XSRF-TOKEN"))
                .map(HttpCookie::getValue).findFirst().orElseThrow();
        }

        // Send read-only requests with the existing session cookie.
        HttpResponse<String> get(String path) throws Exception {
            return http.send(HttpRequest.newBuilder(URI.create(base + path)).GET().build(), HttpResponse.BodyHandlers.ofString());
        }

        // Exercise form-login's actual URL-encoded contract.
        HttpResponse<String> login(String email, String password) throws Exception {
            return send("POST", "/api/auth/login", "email=" + URLEncoder.encode(email, StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(password, StandardCharsets.UTF_8), "application/x-www-form-urlencoded", token());
        }

        // Create accounts using the public JSON contract.
        HttpResponse<String> register(String email, String password) throws Exception {
            return json("/api/auth/register", Map.of("email", email, "password", password));
        }

        // Attach the current CSRF token to mutating JSON requests.
        HttpResponse<String> json(String path, Map<String, ?> body) throws Exception {
            return send("POST", path, json.writeValueAsString(body), "application/json", token());
        }

        // Allow tests to deliberately omit or forge headers while retaining browser cookies.
        HttpResponse<String> send(String method, String path, String body, String contentType, String csrf) throws Exception {
            var builder = HttpRequest.newBuilder(URI.create(base + path)).header("Content-Type", contentType)
                .method(method, HttpRequest.BodyPublishers.ofString(body));
            if (csrf != null) builder.header("X-XSRF-TOKEN", csrf);
            return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        }
    }
}
