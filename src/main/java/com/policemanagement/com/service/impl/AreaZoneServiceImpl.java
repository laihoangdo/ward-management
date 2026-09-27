package com.policemanagement.com.service.impl;

import com.policemanagement.com.domain.AreaZone;
import com.policemanagement.com.repository.AreaZoneRepository;
import com.policemanagement.com.service.AreaZoneService;
import com.policemanagement.com.service.dto.AreaZoneDTO;
import com.policemanagement.com.service.mapper.AreaZoneMapper;
import java.util.LinkedList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service Implementation for managing {@link com.policemanagement.com.domain.AreaZone}.
 */
@Service
@Transactional
public class AreaZoneServiceImpl implements AreaZoneService {

    private static final Logger LOG = LoggerFactory.getLogger(AreaZoneServiceImpl.class);

    private final AreaZoneRepository areaZoneRepository;

    private final AreaZoneMapper areaZoneMapper;

    public AreaZoneServiceImpl(AreaZoneRepository areaZoneRepository, AreaZoneMapper areaZoneMapper) {
        this.areaZoneRepository = areaZoneRepository;
        this.areaZoneMapper = areaZoneMapper;
    }

    @Override
    public AreaZoneDTO save(AreaZoneDTO areaZoneDTO) {
        LOG.debug("Request to save AreaZone : {}", areaZoneDTO);
        AreaZone areaZone = areaZoneMapper.toEntity(areaZoneDTO);
        areaZone = areaZoneRepository.save(areaZone);
        return areaZoneMapper.toDto(areaZone);
    }

    @Override
    public AreaZoneDTO update(AreaZoneDTO areaZoneDTO) {
        LOG.debug("Request to update AreaZone : {}", areaZoneDTO);
        AreaZone areaZone = areaZoneMapper.toEntity(areaZoneDTO);
        areaZone = areaZoneRepository.save(areaZone);
        return areaZoneMapper.toDto(areaZone);
    }

    @Override
    public Optional<AreaZoneDTO> partialUpdate(AreaZoneDTO areaZoneDTO) {
        LOG.debug("Request to partially update AreaZone : {}", areaZoneDTO);

        return areaZoneRepository
            .findById(areaZoneDTO.getId())
            .map(existingAreaZone -> {
                areaZoneMapper.partialUpdate(existingAreaZone, areaZoneDTO);

                return existingAreaZone;
            })
            .map(areaZoneRepository::save)
            .map(areaZoneMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AreaZoneDTO> findAll() {
        LOG.debug("Request to get all AreaZones");
        return areaZoneRepository.findAll().stream().map(areaZoneMapper::toDto).collect(Collectors.toCollection(LinkedList::new));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AreaZoneDTO> findOne(Long id) {
        LOG.debug("Request to get AreaZone : {}", id);
        return areaZoneRepository.findById(id).map(areaZoneMapper::toDto);
    }

    @Override
    public void delete(Long id) {
        LOG.debug("Request to delete AreaZone : {}", id);
        areaZoneRepository.deleteById(id);
    }
}
