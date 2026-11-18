package com.policemanagement.com.service.impl;

import com.policemanagement.com.domain.Household;
import com.policemanagement.com.repository.HouseholdRepository;
import com.policemanagement.com.service.HouseholdService;
import com.policemanagement.com.service.dto.HouseholdDTO;
import com.policemanagement.com.service.mapper.HouseholdMapper;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service Implementation for managing {@link com.policemanagement.com.domain.Household}.
 */
@Service
@Transactional
public class HouseholdServiceImpl implements HouseholdService {

    @org.springframework.beans.factory.annotation.Autowired
    private com.policemanagement.com.service.rbac.RbacService rbac;

    private static final Logger LOG = LoggerFactory.getLogger(HouseholdServiceImpl.class);

    private final HouseholdRepository householdRepository;
    private final HouseholdMapper householdMapper;
    private final com.policemanagement.com.repository.HamletRepository hamletRepository;

    public HouseholdServiceImpl(
        HouseholdRepository householdRepository,
        HouseholdMapper householdMapper,
        com.policemanagement.com.repository.HamletRepository hamletRepository
    ) {
        this.householdRepository = householdRepository;
        this.householdMapper = householdMapper;
        this.hamletRepository = hamletRepository;
    }

    private void syncHamlet(Household household, HouseholdDTO dto) {
        if (dto.getHamletId() != null) {
            var h = hamletRepository
                .findById(dto.getHamletId())
                .filter(value -> value.getValidTo() == null)
                .orElseThrow(() ->
                    new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
                        "Invalid or retired hamlet"
                    )
                );
            household.setHamletId(h.getId());
            household.setHamlet(h.getFullName());
        }
    }

    @Override
    public HouseholdDTO save(HouseholdDTO householdDTO) {
        LOG.debug("Request to save Household : {}", householdDTO);
        Household household = householdMapper.toEntity(householdDTO);
        syncHamlet(household, householdDTO);
        household = householdRepository.save(household);
        return householdMapper.toDto(household);
    }

    @Override
    public HouseholdDTO update(HouseholdDTO householdDTO) {
        LOG.debug("Request to update Household : {}", householdDTO);
        Household household = householdMapper.toEntity(householdDTO);
        syncHamlet(household, householdDTO);
        household = householdRepository.save(household);
        return householdMapper.toDto(household);
    }

    @Override
    public Optional<HouseholdDTO> partialUpdate(HouseholdDTO householdDTO) {
        LOG.debug("Request to partially update Household : {}", householdDTO);

        return householdRepository
            .findById(householdDTO.getId())
            .map(existingHousehold -> {
                householdMapper.partialUpdate(existingHousehold, householdDTO);
                syncHamlet(existingHousehold, householdDTO);
                return existingHousehold;
            })
            .map(householdRepository::save)
            .map(householdMapper::toDto);
    }

    public Page<HouseholdDTO> findAllWithEagerRelationships(Pageable pageable) {
        return householdRepository.findAll(rbac.householdScope(false), pageable).map(householdMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<HouseholdDTO> findOne(Long id) {
        LOG.debug("Request to get Household : {}", id);
        return householdRepository.findOneWithEagerRelationships(id).map(householdMapper::toDto);
    }

    @Override
    public void delete(Long id) {
        LOG.debug("Request to delete Household : {}", id);
        householdRepository.deleteById(id);
    }
}
