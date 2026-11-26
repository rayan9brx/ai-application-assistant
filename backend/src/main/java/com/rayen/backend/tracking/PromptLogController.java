package com.rayen.backend.tracking;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.bind.annotation.*;

/**
 * POST /api/prompts: one request from the smart prompt box. Public (guests use it on the
 * homepage) and always 204, so logging never gets in the way of the routing. A valid token links
 * the row to the user; a missing or bad one is ignored.
 */
@RestController
public class PromptLogController {
    private static final Logger log = LoggerFactory.getLogger(PromptLogController.class);

    private final PromptLogService prompts;
    private final JwtDecoder jwtDecoder;

    public PromptLogController(PromptLogService prompts, JwtDecoder jwtDecoder) {
        this.prompts = prompts;
        this.jwtDecoder = jwtDecoder;
    }

    /** The text is truncated to 300 characters on the server whatever the client sends. */
    public record PromptRequest(@Size(max = 20000) String text, @NotBlank @Size(max = 10) String route) {}

    @PostMapping("/api/prompts")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void log(@Valid @RequestBody PromptRequest prompt, HttpServletRequest request) {
        try {
            UUID user = TrackingController.userFromToken(jwtDecoder, request.getHeader(HttpHeaders.AUTHORIZATION));
            prompts.record(prompt.text(), prompt.route(), user);
        } catch (RuntimeException exception) {
            log.warn("Prompt not recorded: {}", exception.getClass().getSimpleName());
        }
    }

    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ignoreInvalid() {}
}
