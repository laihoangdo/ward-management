package com.policemanagement.com.repository;

import com.policemanagement.com.domain.DocumentRecord;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the DocumentRecord entity.
 */
@SuppressWarnings("unused")
@Repository
public interface DocumentRecordRepository extends JpaRepository<DocumentRecord, Long>, JpaSpecificationExecutor<DocumentRecord> {}
