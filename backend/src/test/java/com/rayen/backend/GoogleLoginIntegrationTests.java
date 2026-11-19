package com.rayen.backend;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.test.context.ActiveProfiles;
import static com.rayen.backend.AccountIntegrationTests.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "GOOGLE_CLIENT_ID=mock-google-client", "GOOGLE_CLIENT_SECRET=mock-secret",
    "app.google.public-origin=http://localhost:4200"
})
@ActiveProfiles("test")
@Import(GoogleLoginIntegrationTests.ProviderConfiguration.class)
class GoogleLoginIntegrationTests {
    private static final String START = "/api/oauth2/authorization/google";
    private static final String LINK = "/api/auth/google/link";
    private static final String ME = "/api/auth/me";
    @LocalServerPort int port;
    @Autowired MockGoogle provider;
    @Autowired JdbcTemplate jdbc;

    // Exercise Google-only signup, email changes at Google, and returning draft access by subject.
    @Test
    void firstAndReturningGoogleSignInShareTheSameAccount() throws Exception {
        var browser = new BrowserClient(port);
        String email = UUID.randomUUID() + "@example.test";
        String subject = UUID.randomUUID().toString();
        var start = browser.get(START);
        assertEquals(302, start.statusCode());
        String authorizationUrl = start.headers().firstValue("Location").orElseThrow();
        assertEquals("accounts.google.com", URI.create(authorizationUrl).getHost());
        assertEquals("http://localhost:4200" + GoogleLogin.CALLBACK,
            parameters(URI.create(authorizationUrl).getRawQuery()).get("redirect_uri"));
        assertEquals("success", finish(browser, authorizationUrl, subject, email, true));
        assertIdentity(browser, email, true);
        assertNull(jdbc.queryForObject("SELECT password_hash FROM app_user WHERE google_sub = ?", String.class, subject));
        String draft = saveDraft(browser);
        assertEquals(200, browser.json("/api/auth/logout", Map.of()).statusCode());
        browser.csrf();
        assertEquals(401, browser.login(email, PASSWORD).statusCode());
        assertEquals("success", finish(browser, start(browser), subject, "changed@example.test", true));
        assertIdentity(browser, email, true);
        assertEquals(200, browser.get("/api/applications/" + draft).statusCode());
    }

    // Require password proof and an explicit CSRF-protected link without changing the draft owner.
    @Test
    void matchingEmailRequiresExplicitLinkAndPreservesBothLoginMethods() throws Exception {
        var browser = new BrowserClient(port);
        String email = UUID.randomUUID() + "@example.test";
        String subject = UUID.randomUUID().toString();
        browser.csrf();
        assertEquals(201, browser.register(email, PASSWORD).statusCode());
        assertEquals(401, browser.json(LINK, Map.of()).statusCode());
        assertEquals("link-required", finish(browser, start(browser), subject, email, true));
        assertEquals(401, browser.get(ME).statusCode());

        String guestFlow = start(browser);
        assertEquals(200, browser.login(email, PASSWORD).statusCode());
        assertEquals("failed", finish(browser, guestFlow, subject, email, true));
        assertIdentity(browser, email, false);
        String draft = saveDraft(browser);
        assertEquals(403, browser.send("POST", LINK, "{}", "application/json", null).statusCode());
        assertEquals("link-email-mismatch",
            finish(browser, link(browser), subject, "other@example.test", true));
        assertIdentity(browser, email, false);

        String alreadyLinked = UUID.randomUUID().toString();
        var otherBrowser = new BrowserClient(port);
        assertEquals("success", finish(otherBrowser, start(otherBrowser), alreadyLinked,
            UUID.randomUUID() + "@example.test", true));
        assertEquals("link-conflict", finish(browser, link(browser), alreadyLinked, email, true));
        assertIdentity(browser, email, false);

        assertEquals("success", finish(browser, link(browser), subject, email, true));
        assertIdentity(browser, email, true);
        assertEquals(200, browser.get("/api/applications/" + draft).statusCode());

        browser.csrf();
        assertEquals(200, browser.json("/api/auth/logout", Map.of()).statusCode());
        assertEquals("success", finish(browser, start(browser), subject, email, true));
        assertEquals(200, browser.get("/api/applications/" + draft).statusCode());
        browser.csrf();
        assertEquals(200, browser.json("/api/auth/logout", Map.of()).statusCode());
        browser.csrf();
        assertEquals(200, browser.login(email, PASSWORD).statusCode());
        assertEquals(200, browser.get("/api/applications/" + draft).statusCode());
    }

    // Reject an unverified email and a callback that doesn't match the browser's OAuth state.
    @Test
    void unverifiedEmailAndForgedStateCannotCreateSessions() throws Exception {
        var browser = new BrowserClient(port);
        String email = UUID.randomUUID() + "@example.test";
        String subject = UUID.randomUUID().toString();
        assertEquals("failed", finish(browser, start(browser), subject, email, false));
        var authorization = parameters(URI.create(start(browser)).getRawQuery());
        String code = provider.issueCode(authorization, subject, email, true);
        assertEquals("failed", callback(browser, code, "forged-state"));
        assertTrue(provider.pending.containsKey(code));
        assertEquals(401, browser.get(ME).statusCode());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM app_user WHERE email = ?", Integer.class, email));
    }

    // Read the real authorization redirect without navigating the test browser to Google.
    private static String start(BrowserClient browser) throws Exception {
        var response = browser.get(START);
        assertEquals(302, response.statusCode());
        return response.headers().firstValue("Location").orElseThrow();
    }

    // Obtain an authorization request from the signed-in, CSRF-protected link endpoint.
    private static String link(BrowserClient browser) throws Exception {
        var response = browser.json(LINK, Map.of());
        assertEquals(200, response.statusCode());
        return browser.json.readTree(response.body()).get("authorizationUrl").asString();
    }

    // Supply a single-use provider code bound to the original nonce and PKCE challenge.
    private String finish(BrowserClient browser, String authorizationUrl, String subject, String email,
            boolean verified) throws Exception {
        var authorization = parameters(URI.create(authorizationUrl).getRawQuery());
        String code = provider.issueCode(authorization, subject, email, verified);
        return callback(browser, code, authorization.get("state"));
    }

    // Send the provider response through Spring's actual OAuth login callback filter.
    private static String callback(BrowserClient browser, String code, String state) throws Exception {
        var response = browser.get(GoogleLogin.CALLBACK + "?code=" + code + "&state=" + state);
        assertEquals(302, response.statusCode());
        var location = URI.create(response.headers().firstValue("Location").orElseThrow());
        assertFalse(location.isAbsolute());
        assertEquals("/", location.getPath());
        return parameters(location.getRawQuery()).get("google");
    }

    // Verify the same session identity and link status that Angular sees.
    private static void assertIdentity(BrowserClient browser, String email, boolean linked) throws Exception {
        var response = browser.get(ME);
        assertEquals(200, response.statusCode());
        var body = browser.json.readTree(response.body());
        assertEquals(email, body.get("email").asString());
        assertEquals(linked, body.get("googleLinked").asBoolean());
    }

    // Create a real saved draft through the authenticated API.
    private static String saveDraft(BrowserClient browser) throws Exception {
        browser.csrf();
        var response = browser.json("/api/applications", Map.of(
            "jobTitle", "Test role", "company", "Test company", "language", "English",
            "sourceCv", "Sample CV", "jobDescription", "Sample job", "includeLetter", false,
            "motivation", "", "editedCv", "Edited CV", "demo", true));
        assertEquals(201, response.statusCode());
        return browser.json.readTree(response.body()).get("id").asString();
    }

    // Decode OAuth URL and form fields using the same UTF-8 rules as the browser.
    private static Map<String, String> parameters(String encoded) {
        var values = new HashMap<String, String>();
        for (String field : encoded.split("&")) {
            String[] pair = field.split("=", 2);
            values.put(URLDecoder.decode(pair[0], StandardCharsets.UTF_8),
                URLDecoder.decode(pair[1], StandardCharsets.UTF_8));
        }
        return values;
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ProviderConfiguration {
        // Run a disposable token and JWKS server so no Google credentials are needed.
        @Bean
        MockGoogle mockGoogle() throws Exception { return new MockGoogle(); }

        // Keep the production registration settings and override only the back-channel endpoints.
        @Bean @Primary
        ClientRegistrationRepository mockRegistration(MockGoogle google,
                @Qualifier("googleRegistrations") ClientRegistrationRepository production) {
            var registration = ClientRegistration.withClientRegistration(production.findByRegistrationId("google"))
                .tokenUri(google.origin + "/token").jwkSetUri(google.origin + "/keys").build();
            return new InMemoryClientRegistrationRepository(registration);
        }
    }

    static class MockGoogle implements AutoCloseable {
        private record Code(String jwt, String challenge, String redirectUri) {}
        private final RSAKey key = new RSAKeyGenerator(2048).keyID("mock-google-key").generate();
        private final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        private final Map<String, Code> pending = new ConcurrentHashMap<>();
        final String origin = "http://127.0.0.1:" + server.getAddress().getPort();

        // Expose only the token exchange and the public signing key.
        MockGoogle() throws Exception {
            server.createContext("/keys", request -> respond(request, 200, new JWKSet(key.toPublicJWK()).toString()));
            server.createContext("/token", this::exchange);
            server.start();
        }

        // Generate a signed ID token with Google's issuer and the requested browser nonce.
        String issueCode(Map<String, String> authorization, String subject, String email, boolean verified) throws Exception {
            String code = UUID.randomUUID().toString();
            Instant now = Instant.now();
            var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(),
                new JWTClaimsSet.Builder().issuer("https://accounts.google.com").audience("mock-google-client")
                    .subject(subject).issueTime(Date.from(now)).expirationTime(Date.from(now.plusSeconds(300)))
                    .claim("nonce", authorization.get("nonce")).claim("email", email)
                    .claim("email_verified", verified).build());
            jwt.sign(new RSASSASigner(key));
            pending.put(code, new Code(jwt.serialize(), authorization.get("code_challenge"), authorization.get("redirect_uri")));
            return code;
        }

        // Enforce single-use codes, callback URI equality and PKCE in the mocked exchange.
        private void exchange(HttpExchange request) throws IOException {
            var form = parameters(new String(request.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            var code = pending.remove(form.get("code"));
            String verifier = form.getOrDefault("code_verifier", "");
            if (code == null || !code.redirectUri().equals(form.get("redirect_uri"))
                    || !pkceChallenge(verifier).equals(code.challenge())) {
                respond(request, 400, "{\"error\":\"invalid_grant\"}");
                return;
            }
            respond(request, 200, "{\"access_token\":\"mock\",\"token_type\":\"Bearer\",\"expires_in\":300,\"id_token\":\"" + code.jwt() + "\"}");
        }

        // Compute Google's S256 challenge for the verifier received from Spring.
        private static String pkceChallenge(String verifier) {
            try {
                byte[] hash = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
                return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
            } catch (java.security.NoSuchAlgorithmException error) {
                throw new AssertionError(error);
            }
        }

        // Send a small JSON response and close the exchange.
        private static void respond(HttpExchange request, int status, String json) throws IOException {
            byte[] body = json.getBytes(StandardCharsets.UTF_8);
            request.getResponseHeaders().set("Content-Type", "application/json");
            request.sendResponseHeaders(status, body.length);
            try (var stream = request.getResponseBody()) { stream.write(body); }
        }

        // Stop the loopback provider when Spring closes the test context.
        @Override public void close() { server.stop(0); }
    }
}
