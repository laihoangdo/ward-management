package com.policemanagement.com.service;

import com.policemanagement.com.service.dto.HouseholdDTO;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Service Interface for managing {@link com.policemanagement.com.domain.Household}.
 */
public interface HouseholdService {
    /**
     * Save a household.
     *
     * @param householdDTO the entity to save.
     * @return the persisted entity.
     */
    HouseholdDTO save(HouseholdDTO householdDTO);

    /**
     * Updates a household.
     *
     * @param householdDTO the entity to update.
     * @return the persisted entity.
     */
    HouseholdDTO update(HouseholdDTO householdDTO);

    /**
     * Partially updates a household.
     *
     * @param householdDTO the entity to update partially.
     * @return the persisted entity.
     */
    Optional<HouseholdDTO> partialUpdate(HouseholdDTO householdDTO);

    /**
     * Get all the households with eager load of many-to-many relationships.
     *
     * @param pageable the pagination information.
     * @return the list of entities.
     */
    Page<HouseholdDTO> findAllWithEagerRelationships(Pageable pageable);

    /**
     * Get the "id" household.
     *
     * @param id the id of the entity.
     * @return the entity.
     */
    Optional<HouseholdDTO> findOne(Long id);

    /**
     * Delete the "id" household.
     *
     * @param id the id of the entity.
     */
    void delete(Long id);
}
