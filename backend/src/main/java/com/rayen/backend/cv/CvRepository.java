package com.rayen.backend.cv;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/** Every lookup takes the owner's id, so a CV of another user is simply never found. */
public interface CvRepository extends JpaRepository<Cv, UUID> {
    List<Cv> findAllByUserIdOrderByUpdatedAtDesc(UUID userId);

    Optional<Cv> findByIdAndUserId(UUID id, UUID userId);

    long countByUserId(UUID userId);

    @Modifying
    @Query("delete from Cv c where c.userId = :userId")
    void deleteAllOwnedBy(UUID userId);
}
