package com.policemanagement.com.service;

import com.policemanagement.com.domain.*; // for static metamodels
import com.policemanagement.com.domain.Household;
import com.policemanagement.com.repository.HouseholdRepository;
import com.policemanagement.com.service.criteria.HouseholdCriteria;
import com.policemanagement.com.service.dto.HouseholdDTO;
import com.policemanagement.com.service.mapper.HouseholdMapper;
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
 * Service for executing complex queries for {@link Household} entities in the database.
 * The main input is a {@link HouseholdCriteria} which gets converted to {@link Specification},
 * in a way that all the filters must apply.
 * It returns a {@link Page} of {@link HouseholdDTO} which fulfills the criteria.
 */
@Service
@Transactional(readOnly = true)
public class HouseholdQueryService extends QueryService<Household> {

    private static final Logger LOG = LoggerFactory.getLogger(HouseholdQueryService.class);

    private final HouseholdRepository householdRepository;

    private final HouseholdMapper householdMapper;

    public HouseholdQueryService(HouseholdRepository householdRepository, HouseholdMapper householdMapper) {
        this.householdRepository = householdRepository;
        this.householdMapper = householdMapper;
    }

    /**
     * Return a {@link Page} of {@link HouseholdDTO} which matches the criteria from the database.
     * @param criteria The object which holds all the filters, which the entities should match.
     * @param page The page, which should be returned.
     * @return the matching entities.
     */
    @Transactional(readOnly = true)
    public Page<HouseholdDTO> findByCriteria(HouseholdCriteria criteria, Pageable page) {
        LOG.debug("find by criteria : {}, page: {}", criteria, page);
        final Specification<Household> specification = createSpecification(criteria);
        return householdRepository.findAll(specification, page).map(householdMapper::toDto);
    }

    /**
     * Return the number of matching entities in the database.
     * @param criteria The object which holds all the filters, which the entities should match.
     * @return the number of matching entities.
     */
    @Transactional(readOnly = true)
    public long countByCriteria(HouseholdCriteria criteria) {
        LOG.debug("count by criteria : {}", criteria);
        final Specification<Household> specification = createSpecification(criteria);
        return householdRepository.count(specification);
    }

    /**
     * Function to convert {@link HouseholdCriteria} to a {@link Specification}
     * @param criteria The object which holds all the filters, which the entities should match.
     * @return the matching {@link Specification} of the entity.
     */
    protected Specification<Household> createSpecification(HouseholdCriteria criteria) {
        Specification<Household> specification = Specification.unrestricted();
        specification = specification.and((root, query, builder) -> {
            if (Long.class != query.getResultType()) {
                root.fetch(Household_.areaZone, JoinType.LEFT);
            }
            return null;
        });
        if (criteria != null) {
            // This has to be called first, because the distinct method returns null
            specification = specification.and(
                Specification.allOf(
                    Boolean.TRUE.equals(criteria.getDistinct()) ? distinct(criteria.getDistinct()) : Specification.unrestricted(),
                    buildRangeSpecification(criteria.getId(), Household_.id),
                    buildStringSpecification(criteria.getCode(), Household_.code),
                    buildStringSpecification(criteria.getHouseNumber(), Household_.houseNumber),
                    buildStringSpecification(criteria.getStreet(), Household_.street),
                    buildStringSpecification(criteria.getHamlet(), Household_.hamlet),
                    buildStringSpecification(criteria.getNeighborhoodGroup(), Household_.neighborhoodGroup),
                    buildStringSpecification(criteria.getAlley(), Household_.alley),
                    buildStringSpecification(criteria.getOwnerName(), Household_.ownerName),
                    buildStringSpecification(criteria.getOwnerPhone(), Household_.ownerPhone),
                    buildSpecification(criteria.getType(), Household_.type),
                    buildStringSpecification(criteria.getBusinessName(), Household_.businessName),
                    buildStringSpecification(criteria.getBusinessCategory(), Household_.businessCategory),
                    buildRangeSpecification(criteria.getResidentsCount(), Household_.residentsCount),
                    buildRangeSpecification(criteria.getMaleCount(), Household_.maleCount),
                    buildRangeSpecification(criteria.getFemaleCount(), Household_.femaleCount),
                    buildRangeSpecification(criteria.getUnder18Count(), Household_.under18Count),
                    buildRangeSpecification(criteria.getAbove18Count(), Household_.above18Count),
                    buildSpecification(criteria.getStatus(), Household_.status),
                    buildStringSpecification(criteria.getWarningMessage(), Household_.warningMessage),
                    buildStringSpecification(criteria.getLicenseExpiry(), Household_.licenseExpiry),
                    buildStringSpecification(criteria.getLicenseType(), Household_.licenseType),
                    buildRangeSpecification(criteria.getLatitude(), Household_.latitude),
                    buildRangeSpecification(criteria.getLongitude(), Household_.longitude),
                    buildStringSpecification(criteria.getLastCheckedDate(), Household_.lastCheckedDate),
                    buildStringSpecification(criteria.getOfficerInCharge(), Household_.officerInCharge),
                    buildSpecification(criteria.getResidentsId(), root ->
                        root.join(Household_.residentses, JoinType.LEFT).get(Resident_.id)
                    ),
                    buildSpecification(criteria.getAreaZoneId(), root -> root.join(Household_.areaZone, JoinType.LEFT).get(AreaZone_.id))
                )
            );
        }
        return specification;
    }
}
