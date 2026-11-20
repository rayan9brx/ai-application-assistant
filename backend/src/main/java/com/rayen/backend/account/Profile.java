package com.rayen.backend.account;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/** One row per Supabase user; the id is the user's auth id (the JWT "sub"). */
@Entity
@Table(name = "profiles")
public class Profile {
    @Id
    private UUID id;

    @Column(name = "full_name", length = 200)
    private String fullName;

    @Column(nullable = false, length = 20)
    private String plan = "free";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Profile() {}

    public Profile(UUID id, String fullName) {
        this.id = id;
        this.fullName = fullName;
    }

    public UUID getId() { return id; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPlan() { return plan; }
    public Instant getCreatedAt() { return createdAt; }
}
