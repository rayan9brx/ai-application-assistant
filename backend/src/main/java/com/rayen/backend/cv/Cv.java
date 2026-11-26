package com.rayen.backend.cv;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import tools.jackson.databind.JsonNode;

@Entity
@Table(name = "cvs")
public class Cv {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, length = 200)
    private String title;

    /** The CV itself, e.g. {"text": "..."}; stored as jsonb. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private JsonNode content;

    @Column(name = "job_description", length = 15000)
    private String jobDescription;

    /** The PDF layout: classic (default), simple, modern, compact or creative (see CvTemplate). */
    @Column(nullable = false, length = 20)
    private String template = "classic";

    /** Set when the CV was made on /tailor; kept when the CV is edited later. */
    @Column(name = "tailored_company", length = 120)
    private String tailoredCompany;

    @Column(name = "tailored_job_title", length = 160)
    private String tailoredJobTitle;

    /** The estimated job match (0–100) after tailoring. */
    @Column(name = "match_score")
    private Integer matchScore;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Cv() {}

    public Cv(UUID userId, String title, JsonNode content, String jobDescription) {
        this.userId = userId;
        this.title = title;
        this.content = content;
        this.jobDescription = jobDescription;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public JsonNode getContent() { return content; }
    public void setContent(JsonNode content) { this.content = content; }
    public String getJobDescription() { return jobDescription; }
    public void setJobDescription(String jobDescription) { this.jobDescription = jobDescription; }
    public String getTemplate() { return template; }
    public void setTemplate(String template) { this.template = template; }
    public String getTailoredCompany() { return tailoredCompany; }
    public String getTailoredJobTitle() { return tailoredJobTitle; }
    public Integer getMatchScore() { return matchScore; }
    public void setTailoring(String company, String jobTitle, Integer matchScore) {
        this.tailoredCompany = company;
        this.tailoredJobTitle = jobTitle;
        this.matchScore = matchScore;
    }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    /** Marks the CV as changed, e.g. after re-scoring, so it sorts first on the dashboard. */
    public void touch() { this.updatedAt = Instant.now(); }
}
