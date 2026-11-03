package com.rayen.backend;

import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Repository;

@Repository
public class AccountRepository implements UserDetailsService {
    private final JdbcTemplate jdbc;

    // Keep account persistence separate from HTTP and authentication handling.
    public AccountRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    // Use one email representation for registration and authentication.
    public static String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    // Let the database unique constraint arbitrate concurrent registrations.
    public void create(String email, String passwordHash) {
        jdbc.update("INSERT INTO app_user (email, password_hash) VALUES (?, ?)", normalizeEmail(email), passwordHash);
    }

    // Return only the credentials Spring Security needs; never expose hashes over HTTP.
    @Override
    public UserDetails loadUserByUsername(String email) {
        var users = jdbc.query("SELECT email, password_hash FROM app_user WHERE email = ?",
            (row, number) -> User.withUsername(row.getString("email"))
                .password(row.getString("password_hash")).roles("USER").build(), normalizeEmail(email));
        if (users.isEmpty()) throw new UsernameNotFoundException("Invalid credentials");
        return users.getFirst();
    }
}
