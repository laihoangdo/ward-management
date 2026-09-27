package com.policemanagement.com.service;

import com.policemanagement.com.service.dto.AreaZoneDTO;
import java.util.List;
import java.util.Optional;

/**
 * Service Interface for managing {@link com.policemanagement.com.domain.AreaZone}.
 */
public interface AreaZoneService {
    /**
     * Save a areaZone.
     *
     * @param areaZoneDTO the entity to save.
     * @return the persisted entity.
     */
    AreaZoneDTO save(AreaZoneDTO areaZoneDTO);

    /**
     * Updates a areaZone.
     *
     * @param areaZoneDTO the entity to update.
     * @return the persisted entity.
     */
    AreaZoneDTO update(AreaZoneDTO areaZoneDTO);

    /**
     * Partially updates a areaZone.
     *
     * @param areaZoneDTO the entity to update partially.
     * @return the persisted entity.
     */
    Optional<AreaZoneDTO> partialUpdate(AreaZoneDTO areaZoneDTO);

    /**
     * Get all the areaZones.
     *
     * @return the list of entities.
     */
    List<AreaZoneDTO> findAll();

    /**
     * Get the "id" areaZone.
     *
     * @param id the id of the entity.
     * @return the entity.
     */
    Optional<AreaZoneDTO> findOne(Long id);

    /**
     * Delete the "id" areaZone.
     *
     * @param id the id of the entity.
     */
    void delete(Long id);
}
