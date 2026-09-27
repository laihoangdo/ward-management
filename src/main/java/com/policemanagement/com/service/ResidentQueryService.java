package com.policemanagement.com.service;

import com.policemanagement.com.domain.*; // for static metamodels
import com.policemanagement.com.domain.Resident;
import com.policemanagement.com.repository.ResidentRepository;
import com.policemanagement.com.service.criteria.ResidentCriteria;
import com.policemanagement.com.service.dto.ResidentDTO;
import com.policemanagement.com.service.mapper.ResidentMapper;
import jakarta.persistence.criteria.JoinType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.jhipster.service.QueryService;

/**
 * Service for executing complex queries for {@link Resident} entities in the database.
 * The main input is a {@link ResidentCriteria} which gets converted to {@link Specification},
 * in a way that all the filters must apply.
 * It returns a {@link Page} of {@link ResidentDTO} which fulfills the criteria.
 */
@Service
@Transactional(readOnly = true)
public class ResidentQueryService extends QueryService<Resident> {

    private static final Logger LOG = LoggerFactory.getLogger(ResidentQueryService.class);

    private final ResidentRepository residentRepository;

    private final ResidentMapper residentMapper;

    public ResidentQueryService(ResidentRepository residentRepository, ResidentMapper residentMapper) {
        this.residentRepository = residentRepository;
        this.residentMapper = residentMapper;
    }

    /**
     * Return a {@link Page} of {@link ResidentDTO} which matches the criteria from the database.
     * @param criteria The object which holds all the filters, which the entities should match.
     * @param page The page, which should be returned.
     * @return the matching entities.
     */
    @Transactional(readOnly = true)
    public Page<ResidentDTO> findByCriteria(ResidentCriteria criteria, Pageable page) {
        LOG.debug("find by criteria : {}, page: {}", criteria, page);
        final Specification<Resident> specification = createSpecification(criteria);
        return residentRepository.findAll(specification, page).map(residentMapper::toDto);
    }

    /**
     * Return the number of matching entities in the database.
     * @param criteria The object which holds all the filters, which the entities should match.
     * @return the number of matching entities.
     */
    @Transactional(readOnly = true)
    public long countByCriteria(ResidentCriteria criteria) {
        LOG.debug("count by criteria : {}", criteria);
        final Specification<Resident> specification = createSpecification(criteria);
        return residentRepository.count(specification);
    }

    /**
     * Function to convert {@link ResidentCriteria} to a {@link Specification}
     * @param criteria The object which holds all the filters, which the entities should match.
     * @return the matching {@link Specification} of the entity.
     */
    protected Specification<Resident> createSpecification(ResidentCriteria criteria) {
        Specification<Resident> specification = Specification.unrestricted();
        specification = specification.and((root, query, builder) -> {
            if (Long.class != query.getResultType()) {
                root.fetch(Resident_.household, JoinType.LEFT);
            }
            return null;
        });
        if (criteria != null) {
            // This has to be called first, because the distinct method returns null
            specification = specification.and(
                Specification.allOf(
                    Boolean.TRUE.equals(criteria.getDistinct()) ? distinct(criteria.getDistinct()) : Specification.unrestricted(),
                    buildRangeSpecification(criteria.getId(), Resident_.id),
                    buildStringSpecification(criteria.getFullName(), Resident_.fullName),
                    buildStringSpecification(criteria.getIdCardNumber(), Resident_.idCardNumber),
                    buildRangeSpecification(criteria.getBirthYear(), Resident_.birthYear),
                    buildSpecification(criteria.getGender(), Resident_.gender),
                    buildStringSpecification(criteria.getRelationship(), Resident_.relationship),
                    buildSpecification(criteria.getResidenceType(), Resident_.residenceType),
                    buildRangeSpecification(criteria.getTemporaryRegisteredAt(), Resident_.temporaryRegisteredAt),
                    buildSpecification(criteria.getHouseholdId(), root -> root.join(Resident_.household, JoinType.LEFT).get(Household_.id))
                )
            );
        }
        return specification;
    }
}
