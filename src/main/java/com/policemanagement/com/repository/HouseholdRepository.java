package com.policemanagement.com.repository;

import com.policemanagement.com.domain.Household;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the Household entity.
 */
@Repository
public interface HouseholdRepository extends JpaRepository<Household, Long>, JpaSpecificationExecutor<Household> {
    default Optional<Household> findOneWithEagerRelationships(Long id) {
        return this.findOneWithToOneRelationships(id);
    }

    default List<Household> findAllWithEagerRelationships() {
        return this.findAllWithToOneRelationships();
    }

    default Page<Household> findAllWithEagerRelationships(Pageable pageable) {
        return this.findAllWithToOneRelationships(pageable);
    }

    @Query(
        value = "select household from Household household left join fetch household.areaZone",
        countQuery = "select count(household) from Household household"
    )
    Page<Household> findAllWithToOneRelationships(Pageable pageable);

    @Query("select household from Household household left join fetch household.areaZone")
    List<Household> findAllWithToOneRelationships();

    @Query("select household from Household household left join fetch household.areaZone where household.id =:id")
    Optional<Household> findOneWithToOneRelationships(@Param("id") Long id);
}
