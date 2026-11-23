package com.rayen.backend.tracking;

import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.JsonNode;

/**
 * Stores the token usage of each Claude response (the "usage" object of the Messages API) with an
 * estimated cost, for the admin dashboard. Never stores prompts or answers. Prices are per
 * million tokens and configurable; cache tokens are counted at the input price (an upper bound).
 */
@Component
public class AiUsageRecorder {
    private static final Logger log = LoggerFactory.getLogger(AiUsageRecorder.class);
    private static final BigDecimal MILLION = BigDecimal.valueOf(1_000_000);

    private final JdbcTemplate jdbc;
    private final BigDecimal inputPrice;
    private final BigDecimal outputPrice;

    public AiUsageRecorder(JdbcTemplate jdbc,
                           @Value("${app.ai.price-input-per-mtok:4.00}") BigDecimal inputPrice,
                           @Value("${app.ai.price-output-per-mtok:20.00}") BigDecimal outputPrice) {
        this.jdbc = jdbc;
        this.inputPrice = inputPrice;
        this.outputPrice = outputPrice;
    }

    /** Called for every Claude response; failures are logged and never break the AI request. */
    public void record(String model, JsonNode usage) {
        try {
            if (usage == null || usage.isMissingNode() || usage.isNull()) return;
            long input = usage.path("input_tokens").asLong(0) + usage.path("cache_creation_input_tokens").asLong(0)
                + usage.path("cache_read_input_tokens").asLong(0);
            long output = usage.path("output_tokens").asLong(0);
            BigDecimal cost = inputPrice.multiply(BigDecimal.valueOf(input))
                .add(outputPrice.multiply(BigDecimal.valueOf(output)))
                .divide(MILLION, 6, RoundingMode.HALF_UP);
            jdbc.update("""
                insert into public.ai_usage (user_id, endpoint, model, input_tokens, output_tokens, cost_usd)
                values (?, ?, ?, ?, ?, ?)""",
                currentUser(), currentEndpoint(), model, (int) Math.min(input, Integer.MAX_VALUE),
                (int) Math.min(output, Integer.MAX_VALUE), cost);
        } catch (RuntimeException exception) {
            log.warn("AI usage not recorded: {}", exception.getClass().getSimpleName());
        }
    }

    private static UUID currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken jwt)) return null;
        try {
            return UUID.fromString(jwt.getToken().getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            return null;
        }
    }

    /** "score", "fix" or "tailor", from the request path. */
    private static String currentEndpoint() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            String path = request.getRequestURI();
            String last = path.substring(path.lastIndexOf('/') + 1);
            return last.length() > 20 ? last.substring(0, 20) : last;
        }
        return "unknown";
    }
}
