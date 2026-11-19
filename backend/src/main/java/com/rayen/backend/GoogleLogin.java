package com.rayen.backend;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URI;
import java.util.List;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.*;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
@ConditionalOnProperty(name = "GOOGLE_CLIENT_ID")
public class GoogleLogin {
    private static final String AUTHORIZATION_BASE = "/api/oauth2/authorization";
    static final String CALLBACK = "/api/login/oauth2/code/google";
    private static final String LINK_EMAIL = "applycraft.link.email";
    private final AccountRepository accounts;
    private final ClientRegistrationRepository registrations;
    private final DefaultOAuth2AuthorizationRequestResolver resolver;
    private final AuthorizationRequestRepository<OAuth2AuthorizationRequest> requests = new BoundAuthorizationRequests();

    // Enable Google only when credentials are configured and pin the callback to the public origin.
    @Bean
    static ClientRegistrationRepository googleRegistrations(@Value("${GOOGLE_CLIENT_ID}") String clientId,
            @Value("${GOOGLE_CLIENT_SECRET}") String clientSecret,
            @Value("${app.google.public-origin}") String origin,
            @Value("${server.servlet.session.cookie.secure:true}") boolean secureCookies) {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            throw new IllegalArgumentException("Set both Google OAuth credentials or omit them.");
        }
        URI publicOrigin = URI.create(origin);
        boolean local = !secureCookies && origin.equals("http://localhost:4200");
        if ((!local && !"https".equals(publicOrigin.getScheme())) || publicOrigin.getHost() == null
                || publicOrigin.getRawUserInfo() != null || !publicOrigin.getRawPath().isEmpty()
                || publicOrigin.getRawQuery() != null || publicOrigin.getRawFragment() != null) {
            throw new IllegalArgumentException("Set APPLYCRAFT_PUBLIC_ORIGIN to an HTTPS origin without a trailing slash.");
        }
        return new InMemoryClientRegistrationRepository(CommonOAuth2Provider.GOOGLE.getBuilder("google")
            .clientId(clientId).clientSecret(clientSecret).issuerUri("https://accounts.google.com")
            .redirectUri(origin + CALLBACK).scope("openid", "email")
            .clientSettings(ClientRegistration.ClientSettings.builder().requireProofKey(true).build()).build());
    }

    // Share Spring's OIDC authorization request builder across sign-in and explicit linking.
    public GoogleLogin(AccountRepository accounts, ClientRegistrationRepository registrations) {
        this.accounts = accounts;
        this.registrations = registrations;
        this.resolver = new DefaultOAuth2AuthorizationRequestResolver(registrations, AUTHORIZATION_BASE);
    }

    // Let Spring validate the code, state, nonce and ID token before mapping an app account.
    void configure(HttpSecurity http) throws Exception {
        http.oauth2Login(login -> login
            .clientRegistrationRepository(registrations)
            .authorizedClientRepository(new HttpSessionOAuth2AuthorizedClientRepository())
            .loginPage("/")
            .authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(resolver)
                .authorizationRequestRepository(requests))
            .redirectionEndpoint(endpoint -> endpoint.baseUri(CALLBACK))
            .userInfoEndpoint(endpoint -> endpoint.oidcUserService(this::loadAccount))
            .successHandler((request, response, auth) -> redirectResult(response, "success"))
            .failureHandler((request, response, error) -> {
                String result = "failed";
                if (error instanceof OAuth2AuthenticationException oauth) {
                    result = switch (oauth.getError().getErrorCode()) {
                        case "link_required" -> "link-required";
                        case "link_email_mismatch" -> "link-email-mismatch";
                        case "link_conflict" -> "link-conflict";
                        default -> "failed";
                    };
                }
                redirectResult(response, result);
            }));
    }

    // Return to the browser's public origin even when Spring sees an internal proxy host.
    private static void redirectResult(HttpServletResponse response, String result) {
        response.setStatus(HttpServletResponse.SC_FOUND);
        response.setHeader("Location", "/?google=" + result + "#account-heading");
    }

    // Start a link only from an explicit CSRF-protected request in a password session.
    String beginLink(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        if (!(authentication instanceof UsernamePasswordAuthenticationToken) || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        String email = authentication.getName();
        if (accounts.hasGoogleAccount(email)) throw new ResponseStatusException(HttpStatus.CONFLICT);
        var authorization = OAuth2AuthorizationRequest.from(resolver.resolve(request, "google"))
            .attributes(attributes -> attributes.put(LINK_EMAIL, email)).build();
        requests.saveAuthorizationRequest(authorization, request, response);
        return authorization.getAuthorizationRequestUri();
    }

    // Use signed ID-token claims and expose the local account email as the session principal name.
    private OidcUser loadAccount(OidcUserRequest request) {
        var token = request.getIdToken();
        String subject = token.getSubject();
        if (subject == null || subject.isBlank() || subject.length() > 255) {
            throw new OAuth2AuthenticationException("invalid_google_subject");
        }
        var current = SecurityContextHolder.getContext().getAuthentication();
        String email = current instanceof UsernamePasswordAuthenticationToken
            ? linkAccount(current.getName(), token.getEmail(), token.getEmailVerified(), subject)
            : signIn(token.getEmail(), token.getEmailVerified(), subject);
        return new DefaultOidcUser(List.of(new SimpleGrantedAuthority("ROLE_USER")), token) {
            // Keep ownership lookups keyed to the persisted ApplyCraft email.
            @Override
            public String getName() { return email; }
        };
    }

    // Look up returning users by subject and let the unique constraints arbitrate new accounts.
    private String signIn(String providerEmail, Boolean verified, String subject) {
        var existing = accounts.emailForGoogleSubject(subject);
        if (existing.isPresent()) return existing.get();
        String email = verifiedEmail(providerEmail, verified);
        try {
            accounts.createGoogleAccount(email, subject);
            return email;
        } catch (DuplicateKeyException exception) {
            return accounts.emailForGoogleSubject(subject)
                .orElseThrow(() -> new OAuth2AuthenticationException("link_required"));
        }
    }

    // Link a verified matching email while preserving the existing row and its password.
    private String linkAccount(String email, String providerEmail, Boolean verified, String subject) {
        if (!email.equals(verifiedEmail(providerEmail, verified))) {
            throw new OAuth2AuthenticationException("link_email_mismatch");
        }
        try {
            if (accounts.linkGoogleAccount(email, subject)) return email;
        } catch (DuplicateKeyException exception) {
            throw new OAuth2AuthenticationException("link_conflict");
        }
        throw new OAuth2AuthenticationException("link_conflict");
    }

    // Require a verified, storable email when creating or linking an account.
    private static String verifiedEmail(String email, Boolean verified) {
        String normalized = email == null ? "" : AccountRepository.normalizeEmail(email);
        if (!Boolean.TRUE.equals(verified) || normalized.isBlank() || normalized.length() > 254) {
            throw new OAuth2AuthenticationException("invalid_google_email");
        }
        return normalized;
    }

    private static final class BoundAuthorizationRequests implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {
        private final HttpSessionOAuth2AuthorizationRequestRepository delegate =
            new HttpSessionOAuth2AuthorizationRequestRepository();

        // Read only a request whose state matches Spring's stored authorization request.
        @Override
        public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
            return delegate.loadAuthorizationRequest(request);
        }

        // Keep state, nonce, PKCE and the optional link email together in the session.
        @Override
        public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorization, HttpServletRequest request,
                HttpServletResponse response) {
            delegate.saveAuthorizationRequest(authorization, request, response);
        }

        // Reject a callback if the user signed in, signed out, or changed accounts during the flow.
        @Override
        public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request, HttpServletResponse response) {
            var authorization = delegate.removeAuthorizationRequest(request, response);
            if (authorization == null) return null;
            String linkEmail = authorization.getAttribute(LINK_EMAIL);
            var current = SecurityContextHolder.getContext().getAuthentication();
            if (linkEmail == null) {
                return current == null || current instanceof AnonymousAuthenticationToken ? authorization : null;
            }
            return current instanceof UsernamePasswordAuthenticationToken && current.isAuthenticated()
                && Objects.equals(linkEmail, current.getName()) ? authorization : null;
        }
    }
}
