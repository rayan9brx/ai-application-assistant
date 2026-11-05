package com.rayen.backend;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {
    private final JdbcTemplate jdbc;

    public record Input(@NotBlank @Size(max=150) String jobTitle,
        @NotBlank @Size(max=150) String company,
        @NotNull @Pattern(regexp="English|German") String language,
        @NotBlank @Size(max=30000) String sourceCv,
        @NotBlank @Size(max=30000) String jobDescription,
        @NotNull Boolean includeLetter, @NotNull @Size(max=3000) String motivation,
        @NotNull @Size(max=60000) String editedCv,
        @Size(max=60000) String editedLetter, @NotNull Boolean demo,
        @PositiveOrZero Long version) {}

    public record Draft(UUID id, String jobTitle, String company, String language,
        String sourceCv, String jobDescription, boolean includeLetter, String motivation,
        String editedCv, String editedLetter, boolean demo, long version,
        OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    public record Summary(UUID id, String jobTitle, String company, String language,
        boolean demo, long version, OffsetDateTime updatedAt) {}
    public record Page(List<Summary> items, int page, int size, long total) {}

    // Use the shared datasource so Flyway owns the storage schema.
    public ApplicationController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    // Resolve ownership exclusively from the authenticated session's email.
    private long owner(Principal principal) {
        var ids = jdbc.queryForList("SELECT id FROM app_user WHERE email = ?", Long.class, principal.getName());
        if (ids.isEmpty()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return ids.getFirst();
    }

    // Return metadata only, with bounded pagination and deterministic ordering.
    @GetMapping
    public Page list(Principal principal, @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size) {
        if (page < 0 || page > 1000000 || size < 1 || size > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        long user = owner(principal);
        var items = jdbc.query("SELECT id, job_title, company, language, demo, version, updated_at FROM application_draft WHERE user_id = ? ORDER BY updated_at DESC, id LIMIT ? OFFSET ?",
            (r, n) -> new Summary(r.getObject("id", UUID.class), r.getString("job_title"), r.getString("company"), r.getString("language"), r.getBoolean("demo"), r.getLong("version"), r.getObject("updated_at", OffsetDateTime.class)), user, size, (long) page * size);
        return new Page(items, page, size, jdbc.queryForObject("SELECT COUNT(*) FROM application_draft WHERE user_id = ?", Long.class, user));
    }

    // Hide both missing drafts and drafts belonging to another account behind 404.
    @GetMapping("/{id}")
    public Draft read(Principal principal, @PathVariable UUID id) { return find(owner(principal), id); }

    // Persist a new draft and let the server assign identity, timestamps and version.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Draft create(Principal principal, @Valid @RequestBody Input input) {
        validate(input);
        long user = owner(principal);
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO application_draft (id, user_id, job_title, company, language, source_cv, job_description, include_letter, motivation, edited_cv, edited_letter, demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, user, input.jobTitle(), input.company(), input.language(), input.sourceCv(), input.jobDescription(), input.includeLetter(), input.motivation(), input.editedCv(), input.editedLetter(), input.demo());
        return find(user, id);
    }

    // Atomically compare versions so a stale editor cannot overwrite newer work.
    @PutMapping("/{id}")
    @Transactional
    public Draft update(Principal principal, @PathVariable UUID id, @Valid @RequestBody Input input) {
        validate(input);
        if (input.version() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        long user = owner(principal);
        int changed = jdbc.update("UPDATE application_draft SET job_title=?, company=?, language=?, source_cv=?, job_description=?, include_letter=?, motivation=?, edited_cv=?, edited_letter=?, demo=?, version=version+1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND version=?",
            input.jobTitle(), input.company(), input.language(), input.sourceCv(), input.jobDescription(), input.includeLetter(), input.motivation(), input.editedCv(), input.editedLetter(), input.demo(), id, user, input.version());
        if (changed == 0) conflictOrMissing(user, id);
        return find(user, id);
    }

    // Require the listed version for deletion, including ownership in the delete itself.
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Principal principal, @PathVariable UUID id, @RequestParam long version) {
        if (version < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        long user = owner(principal);
        if (jdbc.update("DELETE FROM application_draft WHERE id=? AND user_id=? AND version=?", id, user, version) == 0) conflictOrMissing(user, id);
    }

    // Check related fields without including private document content in errors.
    private void validate(Input input) {
        if (!input.demo() || (input.includeLetter() && input.motivation().isBlank())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    }

    // Keep the same owner predicate on every document lookup.
    private Draft find(long user, UUID id) {
        var rows = jdbc.query("SELECT * FROM application_draft WHERE id=? AND user_id=?", (r, n) -> map(r), id, user);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return rows.getFirst();
    }

    // Distinguish stale own drafts without revealing another user's records.
    private void conflictOrMissing(long user, UUID id) {
        find(user, id);
        throw new ResponseStatusException(HttpStatus.CONFLICT);
    }

    // Map database values without logging any application content.
    private static Draft map(ResultSet r) throws SQLException {
        return new Draft(r.getObject("id", UUID.class), r.getString("job_title"), r.getString("company"), r.getString("language"), r.getString("source_cv"), r.getString("job_description"), r.getBoolean("include_letter"), r.getString("motivation"), r.getString("edited_cv"), r.getString("edited_letter"), r.getBoolean("demo"), r.getLong("version"), r.getObject("created_at", OffsetDateTime.class), r.getObject("updated_at", OffsetDateTime.class));
    }

    // Handle rejected payloads locally so validation diagnostics cannot log documents.
    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalid() { return Map.of("message", "Invalid application fields or lengths."); }

    // Return safe statuses directly instead of dispatching through the protected error route.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> rejected(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of("message", "Application request rejected."));
    }

    // Treat malformed IDs and pagination parameters as client errors without reflecting input.
    @ExceptionHandler({org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidParameter() { return Map.of("message", "Invalid application request parameters."); }
}
