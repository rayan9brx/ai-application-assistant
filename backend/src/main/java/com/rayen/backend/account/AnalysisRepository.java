package com.rayen.backend.account;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/** Every query takes the owner's id as well as the CV id. */
public interface AnalysisRepository extends JpaRepository<Analysis, UUID> {
    List<Analysis> findAllByCvIdAndUserIdOrderByCreatedAtDesc(UUID cvId, UUID userId);

    long countByCvIdAndUserId(UUID cvId, UUID userId);

    Optional<Analysis> findFirstByCvIdAndUserIdOrderByCreatedAtDesc(UUID cvId, UUID userId);

    /** The newest analysis of each of the user's CVs. */
    @Query("select a from Analysis a where a.userId = :userId and a.createdAt = "
        + "(select max(b.createdAt) from Analysis b where b.cvId = a.cvId and b.userId = :userId)")
    List<Analysis> findLatestPerCv(UUID userId);

    @Modifying
    @Query("delete from Analysis a where a.cvId = :cvId and a.userId = :userId")
    void deleteAllForCv(UUID cvId, UUID userId);

    @Modifying
    @Query("delete from Analysis a where a.userId = :userId")
    void deleteAllOwnedBy(UUID userId);
}
