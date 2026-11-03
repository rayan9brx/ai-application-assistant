package com.rayen.backend;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AccountController {
    private final AccountRepository accounts;
    private final PasswordEncoder encoder;

    public record Registration(@NotBlank @Email @Size(max = 254) String email,
                               @NotBlank @Size(min = 12, max = 128) String password) {}

    // Inject persistence and the shared versioned password encoder.
    public AccountController(AccountRepository accounts, PasswordEncoder encoder) {
        this.accounts = accounts;
        this.encoder = encoder;
    }

    // Hash before inserting and never return a password or password hash.
    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@Valid @RequestBody Registration input) {
        try {
            accounts.create(input.email(), encoder.encode(input.password()));
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Account created. Sign in to continue."));
        } catch (DuplicateKeyException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Unable to register with these details. Try signing in or use another email."));
        }
    }

    // Expose only the signed-in email, using the server's authenticated principal.
    @GetMapping("/me")
    public Map<String, String> currentUser(Principal principal) {
        return Map.of("email", principal.getName());
    }

    // Materialize the SPA CSRF cookie before Angular makes an unsafe request.
    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        token.getToken();
        return Map.of("message", "CSRF cookie ready");
    }

    // Suppress validation exceptions that could otherwise log rejected passwords.
    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidRegistration() {
        return Map.of("message", "Use a valid email (up to 254 characters) and a password of 12–128 characters.");
    }
}
