package com.rayen.backend.admin;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * The server-side admin check: the user id comes from the verified JWT and the role from
 * profiles.role in the database. Nothing the browser sends can make someone an admin.
 */
@Component
public class AdminAccess {
    private final JdbcTemplate jdbc;

    public AdminAccess(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean isAdmin(UUID userId) {
        if (userId == null) return false;
        List<String> roles = jdbc.queryForList("select role from public.profiles where id = ?", String.class, userId);
        return !roles.isEmpty() && "admin".equals(roles.get(0));
    }

    public boolean isAdmin(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) return false;
        try {
            return isAdmin(UUID.fromString(jwt.getToken().getSubject()));
        } catch (IllegalArgumentException | NullPointerException exception) {
            return false;
        }
    }
}
