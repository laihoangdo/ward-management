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

    private static final Logger LOG = LoggerFactory.getLogger(HouseholdServiceImpl.class);

    private final HouseholdRepository householdRepository;

    private final HouseholdMapper householdMapper;

    public HouseholdServiceImpl(HouseholdRepository householdRepository, HouseholdMapper householdMapper) {
        this.householdRepository = householdRepository;
        this.householdMapper = householdMapper;
    }

    @Override
    public HouseholdDTO save(HouseholdDTO householdDTO) {
        LOG.debug("Request to save Household : {}", householdDTO);
        Household household = householdMapper.toEntity(householdDTO);
        household = householdRepository.save(household);
        return householdMapper.toDto(household);
    }

    @Override
    public HouseholdDTO update(HouseholdDTO householdDTO) {
        LOG.debug("Request to update Household : {}", householdDTO);
        Household household = householdMapper.toEntity(householdDTO);
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

                return existingHousehold;
            })
            .map(householdRepository::save)
            .map(householdMapper::toDto);
    }

    public Page<HouseholdDTO> findAllWithEagerRelationships(Pageable pageable) {
        return householdRepository.findAllWithEagerRelationships(pageable).map(householdMapper::toDto);
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
