package com.rayen.backend.auth;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Supabase Auth Admin API, called from the server only with the project's secret key
 * (SUPABASE_SECRET_KEY). The key never reaches the browser.
 */
@Component
public class SupabaseAdminClient {
    private static final Logger log = LoggerFactory.getLogger(SupabaseAdminClient.class);

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final String baseUrl;
    private final String secretKey;

    public SupabaseAdminClient(@Value("${app.supabase.url}") String supabaseUrl,
                               @Value("${app.supabase.secret-key:}") String secretKey) {
        this.baseUrl = supabaseUrl.strip().replaceAll("/+$", "");
        this.secretKey = secretKey.strip();
    }

    /** Deletes the auth user. A user that is already gone counts as success. */
    public void deleteUser(UUID userId) {
        if (secretKey.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Account deletion is not configured.");
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/auth/v1/admin/users/" + userId))
            .timeout(Duration.ofSeconds(20))
            .header("apikey", secretKey)
            .header("Authorization", "Bearer " + secretKey)
            .DELETE()
            .build();
        int status;
        try {
            status = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
        } catch (IOException e) {
            log.warn("Supabase admin request failed: {}", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach the sign-in service.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach the sign-in service.");
        }
        if (status == 404 || (status >= 200 && status < 300)) return;
        log.warn("Supabase admin delete returned HTTP {}", status);
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not delete the sign-in account.");
    }
}
