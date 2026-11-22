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

    /** 'user' or 'admin'; only ever set by hand in the database, never through the API. */
    @Column(nullable = false, length = 20, updatable = false)
    private String role = "user";

    /** ISO country code of the latest visit (GeoIP); never an IP address. */
    @Column(length = 2)
    private String country;

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
    public String getRole() { return role; }
    public boolean isAdmin() { return "admin".equals(role); }
    public String getCountry() { return country; }
    public Instant getCreatedAt() { return createdAt; }
}
