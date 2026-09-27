package com.policemanagement.com.repository;

import com.policemanagement.com.domain.PatrolLog;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the PatrolLog entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PatrolLogRepository extends JpaRepository<PatrolLog, Long> {}
