package com.policemanagement.com.service;

import com.policemanagement.com.service.dto.PatrolLogDTO;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Service Interface for managing {@link com.policemanagement.com.domain.PatrolLog}.
 */
public interface PatrolLogService {
    /**
     * Save a patrolLog.
     *
     * @param patrolLogDTO the entity to save.
     * @return the persisted entity.
     */
    PatrolLogDTO save(PatrolLogDTO patrolLogDTO);

    /**
     * Updates a patrolLog.
     *
     * @param patrolLogDTO the entity to update.
     * @return the persisted entity.
     */
    PatrolLogDTO update(PatrolLogDTO patrolLogDTO);

    /**
     * Partially updates a patrolLog.
     *
     * @param patrolLogDTO the entity to update partially.
     * @return the persisted entity.
     */
    Optional<PatrolLogDTO> partialUpdate(PatrolLogDTO patrolLogDTO);

    /**
     * Get all the patrolLogs.
     *
     * @param pageable the pagination information.
     * @return the list of entities.
     */
    Page<PatrolLogDTO> findAll(Pageable pageable);

    /**
     * Get the "id" patrolLog.
     *
     * @param id the id of the entity.
     * @return the entity.
     */
    Optional<PatrolLogDTO> findOne(Long id);

    /**
     * Delete the "id" patrolLog.
     *
     * @param id the id of the entity.
     */
    void delete(Long id);
}
