package com.policemanagement.com.service;

import com.policemanagement.com.domain.*; // for static metamodels
import com.policemanagement.com.domain.SecurityAlert;
import com.policemanagement.com.repository.SecurityAlertRepository;
import com.policemanagement.com.service.criteria.SecurityAlertCriteria;
import com.policemanagement.com.service.dto.SecurityAlertDTO;
import com.policemanagement.com.service.mapper.SecurityAlertMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.jhipster.service.QueryService;

/**
 * Service for executing complex queries for {@link SecurityAlert} entities in the database.
 * The main input is a {@link SecurityAlertCriteria} which gets converted to {@link Specification},
 * in a way that all the filters must apply.
 * It returns a {@link Page} of {@link SecurityAlertDTO} which fulfills the criteria.
 */
@Service
@Transactional(readOnly = true)
public class SecurityAlertQueryService extends QueryService<SecurityAlert> {

    private static final Logger LOG = LoggerFactory.getLogger(SecurityAlertQueryService.class);

    private final SecurityAlertRepository securityAlertRepository;

    private final SecurityAlertMapper securityAlertMapper;

    public SecurityAlertQueryService(SecurityAlertRepository securityAlertRepository, SecurityAlertMapper securityAlertMapper) {
        this.securityAlertRepository = securityAlertRepository;
        this.securityAlertMapper = securityAlertMapper;
    }

    /**
     * Return a {@link Page} of {@link SecurityAlertDTO} which matches the criteria from the database.
     * @param criteria The object which holds all the filters, which the entities should match.
     * @param page The page, which should be returned.
     * @return the matching entities.
     */
    @Transactional(readOnly = true)
    public Page<SecurityAlertDTO> findByCriteria(SecurityAlertCriteria criteria, Pageable page) {
        LOG.debug("find by criteria : {}, page: {}", criteria, page);
        final Specification<SecurityAlert> specification = createSpecification(criteria);
        return securityAlertRepository.findAll(specification, page).map(securityAlertMapper::toDto);
    }

    /**
     * Return the number of matching entities in the database.
     * @param criteria The object which holds all the filters, which the entities should match.
     * @return the number of matching entities.
     */
    @Transactional(readOnly = true)
    public long countByCriteria(SecurityAlertCriteria criteria) {
        LOG.debug("count by criteria : {}", criteria);
        final Specification<SecurityAlert> specification = createSpecification(criteria);
        return securityAlertRepository.count(specification);
    }

    /**
     * Function to convert {@link SecurityAlertCriteria} to a {@link Specification}
     * @param criteria The object which holds all the filters, which the entities should match.
     * @return the matching {@link Specification} of the entity.
     */
    protected Specification<SecurityAlert> createSpecification(SecurityAlertCriteria criteria) {
        Specification<SecurityAlert> specification = Specification.unrestricted();
        if (criteria != null) {
            // This has to be called first, because the distinct method returns null
            specification = specification.and(
                Specification.allOf(
                    Boolean.TRUE.equals(criteria.getDistinct()) ? distinct(criteria.getDistinct()) : Specification.unrestricted(),
                    buildRangeSpecification(criteria.getId(), SecurityAlert_.id),
                    buildStringSpecification(criteria.getAlertType(), SecurityAlert_.alertType),
                    buildSpecification(criteria.getSeverity(), SecurityAlert_.severity),
                    buildStringSpecification(criteria.getTitle(), SecurityAlert_.title),
                    buildStringSpecification(criteria.getLocation(), SecurityAlert_.location),
                    buildSpecification(criteria.getIsResolved(), SecurityAlert_.isResolved),
                    buildRangeSpecification(criteria.getReportedAt(), SecurityAlert_.reportedAt),
                    buildRangeSpecification(criteria.getResolvedAt(), SecurityAlert_.resolvedAt)
                )
            );
        }
        return specification;
    }
}
