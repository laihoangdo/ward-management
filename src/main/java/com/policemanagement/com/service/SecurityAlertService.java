package com.policemanagement.com.service;

import com.policemanagement.com.service.dto.SecurityAlertDTO;
import java.util.Optional;

/**
 * Service Interface for managing {@link com.policemanagement.com.domain.SecurityAlert}.
 */
public interface SecurityAlertService {
    /**
     * Save a securityAlert.
     *
     * @param securityAlertDTO the entity to save.
     * @return the persisted entity.
     */
    SecurityAlertDTO save(SecurityAlertDTO securityAlertDTO);

    /**
     * Updates a securityAlert.
     *
     * @param securityAlertDTO the entity to update.
     * @return the persisted entity.
     */
    SecurityAlertDTO update(SecurityAlertDTO securityAlertDTO);

    /**
     * Partially updates a securityAlert.
     *
     * @param securityAlertDTO the entity to update partially.
     * @return the persisted entity.
     */
    Optional<SecurityAlertDTO> partialUpdate(SecurityAlertDTO securityAlertDTO);

    /**
     * Get the "id" securityAlert.
     *
     * @param id the id of the entity.
     * @return the entity.
     */
    Optional<SecurityAlertDTO> findOne(Long id);

    /**
     * Delete the "id" securityAlert.
     *
     * @param id the id of the entity.
     */
    void delete(Long id);
}
