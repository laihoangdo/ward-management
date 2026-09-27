package com.policemanagement.com.service.impl;

import com.policemanagement.com.domain.SecurityAlert;
import com.policemanagement.com.repository.SecurityAlertRepository;
import com.policemanagement.com.service.SecurityAlertService;
import com.policemanagement.com.service.dto.SecurityAlertDTO;
import com.policemanagement.com.service.mapper.SecurityAlertMapper;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service Implementation for managing {@link com.policemanagement.com.domain.SecurityAlert}.
 */
@Service
@Transactional
public class SecurityAlertServiceImpl implements SecurityAlertService {

    private static final Logger LOG = LoggerFactory.getLogger(SecurityAlertServiceImpl.class);

    private final SecurityAlertRepository securityAlertRepository;

    private final SecurityAlertMapper securityAlertMapper;

    public SecurityAlertServiceImpl(SecurityAlertRepository securityAlertRepository, SecurityAlertMapper securityAlertMapper) {
        this.securityAlertRepository = securityAlertRepository;
        this.securityAlertMapper = securityAlertMapper;
    }

    @Override
    public SecurityAlertDTO save(SecurityAlertDTO securityAlertDTO) {
        LOG.debug("Request to save SecurityAlert : {}", securityAlertDTO);
        SecurityAlert securityAlert = securityAlertMapper.toEntity(securityAlertDTO);
        securityAlert = securityAlertRepository.save(securityAlert);
        return securityAlertMapper.toDto(securityAlert);
    }

    @Override
    public SecurityAlertDTO update(SecurityAlertDTO securityAlertDTO) {
        LOG.debug("Request to update SecurityAlert : {}", securityAlertDTO);
        SecurityAlert securityAlert = securityAlertMapper.toEntity(securityAlertDTO);
        securityAlert = securityAlertRepository.save(securityAlert);
        return securityAlertMapper.toDto(securityAlert);
    }

    @Override
    public Optional<SecurityAlertDTO> partialUpdate(SecurityAlertDTO securityAlertDTO) {
        LOG.debug("Request to partially update SecurityAlert : {}", securityAlertDTO);

        return securityAlertRepository
            .findById(securityAlertDTO.getId())
            .map(existingSecurityAlert -> {
                securityAlertMapper.partialUpdate(existingSecurityAlert, securityAlertDTO);

                return existingSecurityAlert;
            })
            .map(securityAlertRepository::save)
            .map(securityAlertMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SecurityAlertDTO> findOne(Long id) {
        LOG.debug("Request to get SecurityAlert : {}", id);
        return securityAlertRepository.findById(id).map(securityAlertMapper::toDto);
    }

    @Override
    public void delete(Long id) {
        LOG.debug("Request to delete SecurityAlert : {}", id);
        securityAlertRepository.deleteById(id);
    }
}
