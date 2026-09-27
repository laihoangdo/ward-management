package com.policemanagement.com.service;

import com.policemanagement.com.domain.*; // for static metamodels
import com.policemanagement.com.domain.DocumentRecord;
import com.policemanagement.com.repository.DocumentRecordRepository;
import com.policemanagement.com.service.criteria.DocumentRecordCriteria;
import com.policemanagement.com.service.dto.DocumentRecordDTO;
import com.policemanagement.com.service.mapper.DocumentRecordMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.jhipster.service.QueryService;

/**
 * Service for executing complex queries for {@link DocumentRecord} entities in the database.
 * The main input is a {@link DocumentRecordCriteria} which gets converted to {@link Specification},
 * in a way that all the filters must apply.
 * It returns a {@link Page} of {@link DocumentRecordDTO} which fulfills the criteria.
 */
@Service
@Transactional(readOnly = true)
public class DocumentRecordQueryService extends QueryService<DocumentRecord> {

    private static final Logger LOG = LoggerFactory.getLogger(DocumentRecordQueryService.class);

    private final DocumentRecordRepository documentRecordRepository;

    private final DocumentRecordMapper documentRecordMapper;

    public DocumentRecordQueryService(DocumentRecordRepository documentRecordRepository, DocumentRecordMapper documentRecordMapper) {
        this.documentRecordRepository = documentRecordRepository;
        this.documentRecordMapper = documentRecordMapper;
    }

    /**
     * Return a {@link Page} of {@link DocumentRecordDTO} which matches the criteria from the database.
     * @param criteria The object which holds all the filters, which the entities should match.
     * @param page The page, which should be returned.
     * @return the matching entities.
     */
    @Transactional(readOnly = true)
    public Page<DocumentRecordDTO> findByCriteria(DocumentRecordCriteria criteria, Pageable page) {
        LOG.debug("find by criteria : {}, page: {}", criteria, page);
        final Specification<DocumentRecord> specification = createSpecification(criteria);
        return documentRecordRepository.findAll(specification, page).map(documentRecordMapper::toDto);
    }

    /**
     * Return the number of matching entities in the database.
     * @param criteria The object which holds all the filters, which the entities should match.
     * @return the number of matching entities.
     */
    @Transactional(readOnly = true)
    public long countByCriteria(DocumentRecordCriteria criteria) {
        LOG.debug("count by criteria : {}", criteria);
        final Specification<DocumentRecord> specification = createSpecification(criteria);
        return documentRecordRepository.count(specification);
    }

    /**
     * Function to convert {@link DocumentRecordCriteria} to a {@link Specification}
     * @param criteria The object which holds all the filters, which the entities should match.
     * @return the matching {@link Specification} of the entity.
     */
    protected Specification<DocumentRecord> createSpecification(DocumentRecordCriteria criteria) {
        Specification<DocumentRecord> specification = Specification.unrestricted();
        if (criteria != null) {
            // This has to be called first, because the distinct method returns null
            specification = specification.and(
                Specification.allOf(
                    Boolean.TRUE.equals(criteria.getDistinct()) ? distinct(criteria.getDistinct()) : Specification.unrestricted(),
                    buildRangeSpecification(criteria.getId(), DocumentRecord_.id),
                    buildStringSpecification(criteria.getDocName(), DocumentRecord_.docName),
                    buildStringSpecification(criteria.getDocType(), DocumentRecord_.docType),
                    buildStringSpecification(criteria.getHouseholdName(), DocumentRecord_.householdName),
                    buildStringSpecification(criteria.getAddress(), DocumentRecord_.address),
                    buildStringSpecification(criteria.getStatus(), DocumentRecord_.status),
                    buildStringSpecification(criteria.getExpiryDate(), DocumentRecord_.expiryDate),
                    buildStringSpecification(criteria.getOfficer(), DocumentRecord_.officer),
                    buildStringSpecification(criteria.getPhone(), DocumentRecord_.phone),
                    buildSpecification(criteria.getReminderSent(), DocumentRecord_.reminderSent)
                )
            );
        }
        return specification;
    }
}
