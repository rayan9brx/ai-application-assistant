package com.rayen.backend.auth;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** public.onboarding_answers, one row per user. Every query is filtered by the user's id. */
@Repository
public class OnboardingRepository {
    private final NamedParameterJdbcTemplate db;

    public OnboardingRepository(NamedParameterJdbcTemplate db) {
        this.db = db;
    }

    public record Answers(String challenge, String foundJobs, String searchStatus, String experienceLevel,
                          List<String> roles, List<String> workModes, List<String> locations, String minSalary) {}

    public record Row(Answers answers, boolean completed, Integer skippedAtStep) {}

    public Optional<Row> find(UUID userId) {
        return db.query("select * from public.onboarding_answers where user_id = :user",
            new MapSqlParameterSource("user", userId), (rs, i) -> new Row(new Answers(
                rs.getString("challenge"), rs.getString("found_jobs"), rs.getString("search_status"),
                rs.getString("experience_level"), list(rs, "roles"), list(rs, "work_modes"),
                list(rs, "locations"), rs.getString("min_salary")),
                rs.getBoolean("completed"), (Integer) rs.getObject("skipped_at_step"))).stream().findFirst();
    }

    /**
     * Inserts or replaces the answers. Finishing and skipping are sticky: once completed it stays
     * completed, and only the first skip's step is kept.
     */
    public void save(UUID userId, Answers a, boolean completed, Integer skippedAtStep) {
        var p = new MapSqlParameterSource("user", userId)
            .addValue("challenge", a.challenge()).addValue("foundJobs", a.foundJobs())
            .addValue("searchStatus", a.searchStatus()).addValue("experience", a.experienceLevel())
            .addValue("roles", a.roles().toArray(String[]::new))
            .addValue("workModes", a.workModes().toArray(String[]::new))
            .addValue("locations", a.locations().toArray(String[]::new))
            .addValue("minSalary", a.minSalary()).addValue("completed", completed)
            .addValue("skipped", skippedAtStep);
        db.update("""
            insert into public.onboarding_answers (user_id, challenge, found_jobs, search_status, experience_level,
                roles, work_modes, locations, min_salary, completed, skipped_at_step)
            values (:user, :challenge, :foundJobs, :searchStatus, :experience, :roles, :workModes, :locations,
                :minSalary, :completed, :skipped)
            on conflict (user_id) do update set
                challenge = excluded.challenge, found_jobs = excluded.found_jobs,
                search_status = excluded.search_status, experience_level = excluded.experience_level,
                roles = excluded.roles, work_modes = excluded.work_modes, locations = excluded.locations,
                min_salary = excluded.min_salary,
                completed = onboarding_answers.completed or excluded.completed,
                skipped_at_step = coalesce(onboarding_answers.skipped_at_step, excluded.skipped_at_step),
                updated_at = now()""", p);
    }

    public void deleteFor(UUID userId) {
        db.update("delete from public.onboarding_answers where user_id = :user",
            new MapSqlParameterSource("user", userId));
    }

    private static List<String> list(ResultSet rs, String column) throws SQLException {
        Array array = rs.getArray(column);
        return array == null ? List.of() : List.of((String[]) array.getArray());
    }
}
