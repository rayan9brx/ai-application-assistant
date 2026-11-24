package com.rayen.backend.auth;

import com.rayen.backend.admin.AdminAccess;
import com.rayen.backend.analysis.Analysis;
import com.rayen.backend.analysis.AnalysisRepository;
import com.rayen.backend.cv.Cv;
import com.rayen.backend.cv.CvRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * All account data access. Every method takes the authenticated user's id (the JWT "sub")
 * and only ever touches that user's rows; another user's CV looks exactly like a missing one.
 */
@Service
public class AccountService {
    static final int MAX_CVS = 200;
    static final int MAX_ANALYSES_PER_CV = 500;
    static final int MAX_JSON_CHARS = 200_000;

    private final ProfileRepository profiles;
    private final CvRepository cvs;
    private final AnalysisRepository analyses;
    private final SupabaseAdminClient admin;
    private final OnboardingRepository onboarding;
    private final AdminAccess admins;
    private final JsonMapper json = JsonMapper.builder().build();

    public AccountService(ProfileRepository profiles, CvRepository cvs, AnalysisRepository analyses,
                          SupabaseAdminClient admin, OnboardingRepository onboarding, AdminAccess admins) {
        this.profiles = profiles;
        this.cvs = cvs;
        this.analyses = analyses;
        this.admin = admin;
        this.onboarding = onboarding;
        this.admins = admins;
    }

    /**
     * Returns the user's profile, creating it on first use (the auth user already exists).
     * Called outside any surrounding transaction, so the insert commits on its own: when two first
     * requests race, the loser's failed insert can't abort other work (Postgres would reject every
     * later statement in that transaction) and it simply reads the winner's row.
     */
    public Profile profile(UUID userId, String nameFromSignup) {
        Optional<Profile> existing = profiles.findById(userId);
        if (existing.isPresent()) {
            Profile profile = existing.get();
            // A profile first created by a request that didn't carry the name picks it up later.
            if (profile.getFullName() == null && clean(nameFromSignup) != null) {
                profile.setFullName(clean(nameFromSignup));
                return profiles.saveAndFlush(profile);
            }
            return profile;
        }
        try {
            return profiles.saveAndFlush(new Profile(userId, clean(nameFromSignup)));
        } catch (DataIntegrityViolationException raced) {
            return profiles.findById(userId).orElseThrow(() -> raced);
        }
    }

    /** Not @Transactional on purpose: profile() may insert and must not share a transaction. */
    public Profile rename(UUID userId, String fullName) {
        Profile profile = profile(userId, null);
        profile.setFullName(clean(fullName));
        return profiles.saveAndFlush(profile);
    }

    /** Deletes the sign-in account first (so a failure leaves everything intact), then all rows. */
    @Transactional
    public void deleteAccount(UUID userId) {
        admin.deleteUser(userId);
        onboarding.deleteFor(userId);
        analyses.deleteAllOwnedBy(userId);
        cvs.deleteAllOwnedBy(userId);
        profiles.deleteAllByIdInBatch(List.of(userId));
    }

    public List<Cv> listCvs(UUID userId) {
        return cvs.findAllByUserIdOrderByUpdatedAtDesc(userId);
    }

    public Map<UUID, Analysis> latestAnalyses(UUID userId) {
        return analyses.findLatestPerCv(userId).stream()
            .collect(Collectors.toMap(Analysis::getCvId, a -> a, (a, b) -> a));
    }

    public Cv cv(UUID userId, UUID cvId) {
        return cvs.findByIdAndUserId(cvId, userId).orElseThrow(AccountService::notFound);
    }

    /** Not @Transactional on purpose: profile() may insert and must not share a transaction. */
    /** A null template means the default, 'classic'. */
    public Cv createCv(UUID userId, String title, JsonNode content, String jobDescription, String template) {
        profile(userId, null);
        // Admins have no limits; the role comes from the database, never from the request.
        if (cvs.countByUserId(userId) >= MAX_CVS && !admins.isAdmin(userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have reached the limit of saved CVs.");
        }
        var cv = new Cv(userId, title.strip(), checkedJson(content), blankToNull(jobDescription));
        if (template != null) cv.setTemplate(template);
        return cvs.saveAndFlush(cv);
    }

    /** A null template keeps the CV's current one. */
    @Transactional
    public Cv updateCv(UUID userId, UUID cvId, String title, JsonNode content, String jobDescription,
                       String template) {
        Cv cv = cv(userId, cvId);
        cv.setTitle(title.strip());
        cv.setContent(checkedJson(content));
        cv.setJobDescription(blankToNull(jobDescription));
        if (template != null) cv.setTemplate(template);
        cv.touch();
        return cvs.saveAndFlush(cv);
    }

    @Transactional
    public Cv duplicateCv(UUID userId, UUID cvId) {
        Cv source = cv(userId, cvId);
        String title = source.getTitle().length() > 190 ? source.getTitle().substring(0, 190) : source.getTitle();
        return createCv(userId, title + " (copy)", source.getContent().deepCopy(), source.getJobDescription(),
            source.getTemplate());
    }

    @Transactional
    public void deleteCv(UUID userId, UUID cvId) {
        Cv cv = cv(userId, cvId);
        analyses.deleteAllForCv(cv.getId(), userId);
        cvs.delete(cv);
    }

    public List<Analysis> history(UUID userId, UUID cvId) {
        cv(userId, cvId);
        return analyses.findAllByCvIdAndUserIdOrderByCreatedAtDesc(cvId, userId);
    }

    /** Stores one scoring result; the overall and category scores are read from it. */
    @Transactional
    public Analysis saveAnalysis(UUID userId, UUID cvId, JsonNode result) {
        Cv cv = cv(userId, cvId);
        checkedJson(result);
        JsonNode overall = result.get("overall");
        JsonNode categories = result.get("categories");
        if (overall == null || !overall.isInt() || overall.asInt() < 0 || overall.asInt() > 100
            || categories == null || !categories.isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The analysis is missing its scores.");
        }
        if (analyses.countByCvIdAndUserId(cv.getId(), userId) >= MAX_ANALYSES_PER_CV) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This CV has too many saved analyses.");
        }
        cv.touch();
        cvs.saveAndFlush(cv);
        return analyses.saveAndFlush(new Analysis(cv.getId(), userId, overall.asInt(), categories, result,
            nextAnalysisTime(cv.getId(), userId)));
    }

    /**
     * Now, at the database's microsecond precision, but always after the CV's previous analysis:
     * two scores saved within one clock tick would otherwise tie and "latest" would be ambiguous.
     */
    private Instant nextAnalysisTime(UUID cvId, UUID userId) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        return analyses.findFirstByCvIdAndUserIdOrderByCreatedAtDesc(cvId, userId)
            .map(Analysis::getCreatedAt)
            .filter(previous -> !now.isAfter(previous))
            .map(previous -> previous.plus(1, ChronoUnit.MICROS))
            .orElse(now);
    }

    private JsonNode checkedJson(JsonNode node) {
        if (node == null || !node.isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Expected a JSON object.");
        }
        if (json.writeValueAsString(node).length() > MAX_JSON_CHARS) {
            throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "That is too large to save.");
        }
        return node;
    }

    private static String clean(String value) {
        if (value == null || value.isBlank()) return null;
        String stripped = value.strip();
        return stripped.length() > 200 ? stripped.substring(0, 200) : stripped;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found.");
    }
}
