package com.rayen.backend;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.password.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.http.ResponseCookie;

@Configuration
public class SecurityConfiguration {
    // Use a versioned, salted PBKDF2 encoder without bcrypt's UTF-8 byte limit.
    @Bean
    PasswordEncoder passwordEncoder() {
        String id = "pbkdf2-v5_8";
        return new DelegatingPasswordEncoder(id, Map.of(id, Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8()));
    }

    // Keep authentication in server sessions and protect every mutating endpoint with CSRF.
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
            @Value("${server.servlet.session.cookie.secure:true}") boolean secureCookies,
            @Value("${server.servlet.session.cookie.name:JSESSIONID}") String sessionCookieName) throws Exception {
        var csrfCookies = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfCookies.setCookieCustomizer(cookie -> cookie.path("/").sameSite("Lax").secure(secureCookies));
        http.csrf(csrf -> csrf.spa().csrfTokenRepository(csrfCookies))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/health", "/api/auth/csrf", "/api/auth/register", "/api/auth/login").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll())
            .requestCache(cache -> cache.disable())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, exception) ->
                    json(response, 401, "Sign in to continue. Your entered text is unchanged."))
                .accessDeniedHandler((request, response, exception) ->
                    json(response, 403, "Security check failed. Refresh your sign-in session and try again.")))
            .formLogin(login -> login.loginProcessingUrl("/api/auth/login").usernameParameter("email")
                .successHandler((request, response, authentication) -> json(response, 200, "Signed in"))
                .failureHandler((request, response, exception) -> json(response, 401, "Invalid email or password.")))
            .logout(logout -> logout.logoutUrl("/api/auth/logout")
                .addLogoutHandler((request, response, authentication) -> response.addHeader("Set-Cookie",
                    ResponseCookie.from(sessionCookieName, "").path("/").httpOnly(true)
                        .secure(secureCookies).sameSite("Lax").maxAge(0).build().toString()))
                .logoutSuccessHandler((request, response, authentication) -> json(response, 200, "Signed out")));
        return http.build();
    }

    // Write fixed JSON errors without reflecting credentials or exception details.
    private static void json(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
