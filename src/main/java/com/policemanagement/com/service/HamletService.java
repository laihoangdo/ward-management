package com.policemanagement.com.service;

import com.policemanagement.com.service.dto.HamletDTO;
import java.util.List;
import java.util.Optional;

/**
 * Service Interface for managing {@link com.policemanagement.com.domain.Hamlet}.
 */
public interface HamletService {
    /**
     * Save a administrativeHamlet.
     *
     * @param administrativeHamletDTO the entity to save.
     * @return the persisted entity.
     */
    HamletDTO save(HamletDTO administrativeHamletDTO);

    /**
     * Updates a administrativeHamlet.
     *
     * @param administrativeHamletDTO the entity to update.
     * @return the persisted entity.
     */
    HamletDTO update(HamletDTO administrativeHamletDTO);

    /**
     * Partially updates a administrativeHamlet.
     *
     * @param administrativeHamletDTO the entity to update partially.
     * @return the persisted entity.
     */
    Optional<HamletDTO> partialUpdate(HamletDTO administrativeHamletDTO);

    /**
     * Get all the administrativeHamlets.
     *
     * @return the list of entities.
     */
    List<HamletDTO> findAll();

    /**
     * Get the "id" administrativeHamlet.
     *
     * @param id the id of the entity.
     * @return the entity.
     */
    Optional<HamletDTO> findOne(Long id);

    /**
     * Delete the "id" administrativeHamlet.
     *
     * @param id the id of the entity.
     */
    void delete(Long id);
}
