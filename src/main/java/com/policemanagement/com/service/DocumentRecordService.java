package com.policemanagement.com.service;

import com.policemanagement.com.service.dto.DocumentRecordDTO;
import java.util.Optional;

/**
 * Service Interface for managing {@link com.policemanagement.com.domain.DocumentRecord}.
 */
public interface DocumentRecordService {
    /**
     * Save a documentRecord.
     *
     * @param documentRecordDTO the entity to save.
     * @return the persisted entity.
     */
    DocumentRecordDTO save(DocumentRecordDTO documentRecordDTO);

    /**
     * Updates a documentRecord.
     *
     * @param documentRecordDTO the entity to update.
     * @return the persisted entity.
     */
    DocumentRecordDTO update(DocumentRecordDTO documentRecordDTO);

    /**
     * Partially updates a documentRecord.
     *
     * @param documentRecordDTO the entity to update partially.
     * @return the persisted entity.
     */
    Optional<DocumentRecordDTO> partialUpdate(DocumentRecordDTO documentRecordDTO);

    /**
     * Get the "id" documentRecord.
     *
     * @param id the id of the entity.
     * @return the entity.
     */
    Optional<DocumentRecordDTO> findOne(Long id);

    /**
     * Delete the "id" documentRecord.
     *
     * @param id the id of the entity.
     */
    void delete(Long id);
}
