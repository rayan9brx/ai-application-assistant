package com.rayen.backend;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Calls the Claude Messages API from the server only. The API key comes from the
 * ANTHROPIC_API_KEY environment variable and is never sent to the browser. Responses are
 * constrained to a JSON schema (structured outputs) and returned as a parsed tree.
 */
@Component
public class ClaudeClient {
    private static final Logger log = LoggerFactory.getLogger(ClaudeClient.class);
    private static final String API_VERSION = "2026-10-21";
    /** Server-side refusal fallback, recommended for claude-opus-5-5. */
    private static final String FALLBACK_BETA = "server-side-fallback-2026-07-01";

    private final JsonMapper json = JsonMapper.builder().build();
    private final HttpClient http;
    private final String apiKey;
    private final String model;
    private final String effort;
    private final URI endpoint;
    private final Duration timeout;

    public ClaudeClient(@Value("${ANTHROPIC_API_KEY:}") String apiKey,
                        @Value("${app.ai.model:claude-opus-5-5}") String model,
                        @Value("${app.ai.effort:medium}") String effort,
                        @Value("${app.ai.base-url:https://api.anthropic.com}") String baseUrl,
                        @Value("${app.ai.timeout-seconds:120}") int timeoutSeconds) {
        this.apiKey = apiKey.strip();
        this.model = model;
        this.effort = effort;
        this.endpoint = URI.create(baseUrl.replaceAll("/+$", "") + "/v1/messages");
        this.timeout = Duration.ofSeconds(timeoutSeconds);
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public boolean configured() {
        return !apiKey.isEmpty();
    }

    /** Sends one request and returns the model's JSON answer, which matches `schema`. */
    public JsonNode complete(String system, String user, Map<String, Object> schema) {
        if (!configured()) {
            throw new AiException(HttpStatus.SERVICE_UNAVAILABLE,
                "AI features aren't set up on this server yet. Ask the site owner to configure ANTHROPIC_API_KEY.");
        }
        var body = Map.of(
            "model", model,
            "max_tokens", 16000,
            "system", system,
            "messages", java.util.List.of(Map.of("role", "user", "content", user)),
            "output_config", Map.of("effort", effort, "format", Map.of("type", "json_schema", "schema", schema)),
            "fallbacks", "default");
        var request = HttpRequest.newBuilder(endpoint)
            .timeout(timeout)
            .header("content-type", "application/json")
            .header("x-api-key", apiKey)
            .header("anthropic-version", API_VERSION)
            .header("anthropic-beta", FALLBACK_BETA)
            .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
            .build();
        HttpResponse<String> response = send(request, true);
        return parse(response.body());
    }

    // Retry once on overload, rate limits and network errors; timeouts are already long.
    private HttpResponse<String> send(HttpRequest request, boolean retry) {
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status == 200) return response;
            boolean transientError = status == 429 || status >= 500;
            if (transientError && retry) {
                sleep(1500);
                return send(request, false);
            }
            // Log the status only; error bodies never contain the CV, but keep logs minimal anyway.
            log.warn("Claude API returned HTTP {}", status);
            if (status == 401 || status == 403) {
                throw new AiException(HttpStatus.SERVICE_UNAVAILABLE, "The AI service isn't configured correctly. Please try again later.");
            }
            if (transientError) {
                throw new AiException(HttpStatus.SERVICE_UNAVAILABLE, "The AI service is busy right now. Please try again in a minute.");
            }
            throw new AiException(HttpStatus.BAD_GATEWAY, "The AI request failed. Please try again.");
        } catch (HttpTimeoutException exception) {
            throw new AiException(HttpStatus.GATEWAY_TIMEOUT, "The AI took too long to respond. Please try again.");
        } catch (IOException exception) {
            if (retry) {
                sleep(1500);
                return send(request, false);
            }
            log.warn("Claude API unreachable: {}", exception.getClass().getSimpleName());
            throw new AiException(HttpStatus.SERVICE_UNAVAILABLE, "We couldn't reach the AI service. Please try again in a minute.");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AiException(HttpStatus.SERVICE_UNAVAILABLE, "The AI request was interrupted. Please try again.");
        }
    }

    private JsonNode parse(String body) {
        try {
            JsonNode message = json.readTree(body);
            String stop = message.path("stop_reason").asString("");
            if ("refusal".equals(stop)) {
                throw new AiException(HttpStatus.UNPROCESSABLE_CONTENT, "The AI couldn't review this text. Check that it's a CV and try again.");
            }
            if ("max_tokens".equals(stop)) {
                throw new AiException(HttpStatus.BAD_GATEWAY, "The AI response was cut off. Try a shorter CV.");
            }
            var text = new StringBuilder();
            for (JsonNode block : message.path("content")) {
                if ("text".equals(block.path("type").asString(""))) text.append(block.path("text").asString(""));
            }
            return json.readTree(text.toString());
        } catch (JacksonException exception) {
            throw new InvalidAiResponseException();
        }
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    /** An error with a message that is safe to show to the user. */
    public static class AiException extends RuntimeException {
        final HttpStatus status;

        public AiException(HttpStatus status, String message) {
            super(message);
            this.status = status;
        }
    }

    /** The model answered, but not with JSON we can use; callers may retry once. */
    public static class InvalidAiResponseException extends RuntimeException {}
}
