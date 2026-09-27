package com.policemanagement.com.repository;

import com.policemanagement.com.domain.SecurityAlert;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the SecurityAlert entity.
 */
@SuppressWarnings("unused")
@Repository
public interface SecurityAlertRepository extends JpaRepository<SecurityAlert, Long>, JpaSpecificationExecutor<SecurityAlert> {}
