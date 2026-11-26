package com.rayen.backend.config;

import com.rayen.backend.admin.AdminAccess;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Every API endpoint except the health check needs a Supabase access token (Bearer JWT),
 * verified against the project's JWKS; the user id is the token's "sub" claim. That covers the
 * AI endpoints (score, fix, tailor), file extraction, PDF export, the account and saved CVs, so
 * only signed-in users can run up AI costs. Missing or invalid tokens get a 401. /api/admin/**
 * also needs role 'admin' in the database (AdminAccess), else 403. /api/track (cookieless page
 * views) is public and reads its optional token itself. No sessions or cookies, so CSRF
 * protection is not needed.
 */
@Configuration
public class SecurityConfig {
    static boolean isAccountPath(String path) {
        return path.equals("/api/me") || path.startsWith("/api/me/")
            || path.equals("/api/cvs") || path.startsWith("/api/cvs/");
    }

    /** Everything under /api needs a signed-in user, except the health check, page views and smart prompts. */
    static boolean isProtectedPath(String path) {
        return (path.equals("/api") || path.startsWith("/api/"))
            && !path.equals("/api/health") && !path.equals("/api/track") && !path.equals("/api/prompts");
    }

    static boolean isAdminPath(String path) {
        return path.equals("/api/admin") || path.startsWith("/api/admin/");
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, AdminAccess admins) throws Exception {
        http.csrf(csrf -> csrf.disable())
            // Uses the corsConfigurationSource bean below; answers preflights before authentication.
            .cors(Customizer.withDefaults())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .logout(logout -> logout.disable())
            .authorizeHttpRequests(auth -> auth
                // Checked on the server for every request, from the JWT user's row in profiles.
                .requestMatchers(request -> isAdminPath(request.getRequestURI()))
                    .access((authentication, context) -> new AuthorizationDecision(admins.isAdmin(authentication.get())))
                .requestMatchers(request -> isProtectedPath(request.getRequestURI())).authenticated()
                .anyRequest().permitAll())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint(SecurityConfig::unauthorized)
                .accessDeniedHandler(SecurityConfig::forbidden))
            .oauth2ResourceServer(server -> server
                .bearerTokenResolver(protectedTokenResolver())
                .authenticationEntryPoint(SecurityConfig::unauthorized)
                .jwt(Customizer.withDefaults()));
        return http.build();
    }

    /**
     * The frontend runs on another origin than the API, so the browser needs CORS. Only the
     * FRONTEND_URL origin (comma-separated if there are several, e.g. with and without www) and
     * the local dev server are allowed. Tokens travel in the Authorization header, not cookies,
     * so credentials stay off.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${FRONTEND_URL:}") String frontendUrl) {
        var origins = new java.util.ArrayList<String>();
        for (String origin : frontendUrl.split(",")) {
            String trimmed = origin.strip().replaceAll("/+$", "");
            if (!trimmed.isEmpty()) origins.add(trimmed);
        }
        origins.add("http://localhost:4200");
        var config = new CorsConfiguration();
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setExposedHeaders(List.of("Content-Disposition"));
        config.setMaxAge(3600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    /** Public paths ignore tokens, so a stale token can never break the health check. */
    private static BearerTokenResolver protectedTokenResolver() {
        DefaultBearerTokenResolver resolver = new DefaultBearerTokenResolver();
        return (HttpServletRequest request) -> isProtectedPath(request.getRequestURI()) ? resolver.resolve(request) : null;
    }

    /** A JSON 401 the frontend can show, for a missing, expired or invalid token. */
    private static void unauthorized(HttpServletRequest request, HttpServletResponse response,
                                     AuthenticationException exception) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setHeader("WWW-Authenticate", "Bearer");
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"Please log in to continue.\"}");
    }

    private static void forbidden(HttpServletRequest request, HttpServletResponse response,
                                  AccessDeniedException exception) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"You don't have access to this.\"}");
    }

    @Bean
    JwtDecoder jwtDecoder(@Value("${app.supabase.url}") String supabaseUrl) {
        String issuer = supabaseUrl.strip().replaceAll("/+$", "") + "/auth/v1";
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(issuer + "/.well-known/jwks.json")
            .jwsAlgorithms(algorithms -> {
                algorithms.add(SignatureAlgorithm.ES256);
                algorithms.add(SignatureAlgorithm.RS256);
            })
            .build();
        JwtClaimValidator<List<String>> audience = new JwtClaimValidator<>(JwtClaimNames.AUD,
            aud -> aud != null && aud.contains("authenticated"));
        JwtClaimValidator<String> subject = new JwtClaimValidator<>(JwtClaimNames.SUB,
            sub -> sub != null && !sub.isBlank());
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer(issuer), audience, subject));
        return decoder;
    }
}
