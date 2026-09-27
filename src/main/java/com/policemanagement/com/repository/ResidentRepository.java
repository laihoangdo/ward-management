package com.policemanagement.com.repository;

import com.policemanagement.com.domain.Resident;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the Resident entity.
 */
@Repository
public interface ResidentRepository extends JpaRepository<Resident, Long>, JpaSpecificationExecutor<Resident> {
    default Optional<Resident> findOneWithEagerRelationships(Long id) {
        return this.findOneWithToOneRelationships(id);
    }

    default List<Resident> findAllWithEagerRelationships() {
        return this.findAllWithToOneRelationships();
    }

    default Page<Resident> findAllWithEagerRelationships(Pageable pageable) {
        return this.findAllWithToOneRelationships(pageable);
    }

    @Query(
        value = "select resident from Resident resident left join fetch resident.household",
        countQuery = "select count(resident) from Resident resident"
    )
    Page<Resident> findAllWithToOneRelationships(Pageable pageable);

    @Query("select resident from Resident resident left join fetch resident.household")
    List<Resident> findAllWithToOneRelationships();

    @Query("select resident from Resident resident left join fetch resident.household where resident.id =:id")
    Optional<Resident> findOneWithToOneRelationships(@Param("id") Long id);
}
