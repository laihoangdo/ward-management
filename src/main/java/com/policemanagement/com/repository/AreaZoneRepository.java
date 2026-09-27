package com.policemanagement.com.repository;

import com.policemanagement.com.domain.AreaZone;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the AreaZone entity.
 */
@SuppressWarnings("unused")
@Repository
public interface AreaZoneRepository extends JpaRepository<AreaZone, Long> {}
