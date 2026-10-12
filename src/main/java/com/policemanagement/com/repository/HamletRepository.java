package com.policemanagement.com.repository;

import com.policemanagement.com.domain.Hamlet;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the {@link Hamlet} entity.
 */
@Repository
public interface HamletRepository extends JpaRepository<Hamlet, Long> {
    List<Hamlet> findByCommuneIdOrderBySortOrderAsc(Long communeId);

    List<Hamlet> findByCommuneIdAndValidToIsNullOrderBySortOrderAsc(Long communeId);

    Optional<Hamlet> findByCode(String code);

    Optional<Hamlet> findByCommuneIdAndNameNormalized(Long communeId, String nameNormalized);
}
