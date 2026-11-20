package com.rayen.backend.account;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import tools.jackson.databind.JsonNode;

/** One scoring run of a saved CV; analyses are never edited, only added or deleted. */
@Entity
@Table(name = "analyses")
public class Analysis {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "cv_id", nullable = false, updatable = false)
    private UUID cvId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "overall_score", nullable = false, updatable = false)
    private int overallScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "category_scores", nullable = false, updatable = false)
    private JsonNode categoryScores;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, updatable = false)
    private JsonNode result;

    /** Set by AccountService, strictly after the CV's previous analysis, so history order is exact. */
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Analysis() {}

    public Analysis(UUID cvId, UUID userId, int overallScore, JsonNode categoryScores, JsonNode result,
                    Instant createdAt) {
        this.createdAt = createdAt;
        this.cvId = cvId;
        this.userId = userId;
        this.overallScore = overallScore;
        this.categoryScores = categoryScores;
        this.result = result;
    }

    public UUID getId() { return id; }
    public UUID getCvId() { return cvId; }
    public UUID getUserId() { return userId; }
    public int getOverallScore() { return overallScore; }
    public JsonNode getCategoryScores() { return categoryScores; }
    public JsonNode getResult() { return result; }
    public Instant getCreatedAt() { return createdAt; }
}
