package com.rayen.backend;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Guests keep using the CV endpoints without an account. Account and saved-CV endpoints need a
 * Supabase access token (Bearer JWT), verified against the project's JWKS; the user id is the
 * token's "sub" claim. No sessions or cookies, so CSRF protection is not needed.
 */
@Configuration
public class SecurityConfig {
    static boolean isAccountPath(String path) {
        return path.equals("/api/me") || path.startsWith("/api/me/")
            || path.equals("/api/cvs") || path.startsWith("/api/cvs/");
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .logout(logout -> logout.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(request -> isAccountPath(request.getRequestURI())).authenticated()
                .anyRequest().permitAll())
            .oauth2ResourceServer(server -> server
                .bearerTokenResolver(accountTokenResolver())
                .jwt(Customizer.withDefaults()));
        return http.build();
    }

    /** Guest endpoints ignore tokens, so a stale token can never break the anonymous flow. */
    private static BearerTokenResolver accountTokenResolver() {
        DefaultBearerTokenResolver resolver = new DefaultBearerTokenResolver();
        return (HttpServletRequest request) -> isAccountPath(request.getRequestURI()) ? resolver.resolve(request) : null;
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
