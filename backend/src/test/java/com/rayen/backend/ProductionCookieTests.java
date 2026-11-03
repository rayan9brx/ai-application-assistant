package com.rayen.backend;

import java.net.*;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "server.servlet.session.cookie.secure=true", "server.servlet.session.cookie.name=__Host-JSESSIONID"
})
@ActiveProfiles("test")
class ProductionCookieTests {
    @LocalServerPort int port;
    @Autowired AccountRepository accounts;
    @Autowired PasswordEncoder encoder;

    // Inspect raw headers because a real browser correctly withholds Secure cookies over HTTP.
    @Test
    void productionCookiesAreSecureAndLogoutClearsTheHostCookie() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        accounts.create(email, encoder.encode(AccountIntegrationTests.PASSWORD));
        var http = HttpClient.newHttpClient();
        String base = "http://localhost:" + port;
        var bootstrap = http.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/csrf")).build(), HttpResponse.BodyHandlers.ofString());
        String csrfCookie = cookieHeader(bootstrap, "XSRF-TOKEN");
        assertTrue(csrfCookie.contains("Secure"));
        assertFalse(csrfCookie.contains("HttpOnly"));
        String csrf = cookieValue(csrfCookie);
        var login = http.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/login"))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Cookie", "XSRF-TOKEN=" + csrf).header("X-XSRF-TOKEN", csrf)
            .POST(HttpRequest.BodyPublishers.ofString("email=" + URLEncoder.encode(email, java.nio.charset.StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(AccountIntegrationTests.PASSWORD, java.nio.charset.StandardCharsets.UTF_8)))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, login.statusCode());
        String session = cookieHeader(login, "__Host-JSESSIONID");
        assertTrue(session.contains("Secure"));
        assertTrue(session.contains("HttpOnly"));
        assertTrue(session.contains("SameSite=Lax"));
        assertTrue(session.contains("Path=/"));
        assertFalse(session.toLowerCase(Locale.ROOT).contains("domain="));
        var fresh = http.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/csrf")).build(), HttpResponse.BodyHandlers.ofString());
        csrf = cookieValue(cookieHeader(fresh, "XSRF-TOKEN"));
        var logout = http.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/logout"))
            .header("Cookie", "__Host-JSESSIONID=" + cookieValue(session) + "; XSRF-TOKEN=" + csrf)
            .header("X-XSRF-TOKEN", csrf).POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, logout.statusCode());
        String cleared = cookieHeader(logout, "__Host-JSESSIONID");
        assertTrue(cleared.contains("Max-Age=0"));
        assertTrue(cleared.contains("Secure"));
        assertTrue(cleared.contains("HttpOnly"));
        var afterLogout = http.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/me"))
            .header("Cookie", "__Host-JSESSIONID=" + cookieValue(session)).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(401, afterLogout.statusCode());
    }

    // Find the exact cookie without assuming the ordering of response headers.
    private String cookieHeader(HttpResponse<?> response, String name) {
        return response.headers().allValues("set-cookie").stream().filter(c -> c.startsWith(name + "=")).findFirst().orElseThrow();
    }

    // Extract only the cookie value for deliberate raw-header requests in this test.
    private String cookieValue(String header) {
        return header.substring(header.indexOf('=') + 1, header.indexOf(';'));
    }
}
