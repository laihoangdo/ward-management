package com.policemanagement.com.service.impl;

import com.policemanagement.com.domain.PatrolLog;
import com.policemanagement.com.repository.PatrolLogRepository;
import com.policemanagement.com.service.PatrolLogService;
import com.policemanagement.com.service.dto.PatrolLogDTO;
import com.policemanagement.com.service.mapper.PatrolLogMapper;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service Implementation for managing {@link com.policemanagement.com.domain.PatrolLog}.
 */
@Service
@Transactional
public class PatrolLogServiceImpl implements PatrolLogService {

    private static final Logger LOG = LoggerFactory.getLogger(PatrolLogServiceImpl.class);

    private final PatrolLogRepository patrolLogRepository;

    private final PatrolLogMapper patrolLogMapper;

    public PatrolLogServiceImpl(PatrolLogRepository patrolLogRepository, PatrolLogMapper patrolLogMapper) {
        this.patrolLogRepository = patrolLogRepository;
        this.patrolLogMapper = patrolLogMapper;
    }

    @Override
    public PatrolLogDTO save(PatrolLogDTO patrolLogDTO) {
        LOG.debug("Request to save PatrolLog : {}", patrolLogDTO);
        PatrolLog patrolLog = patrolLogMapper.toEntity(patrolLogDTO);
        patrolLog = patrolLogRepository.save(patrolLog);
        return patrolLogMapper.toDto(patrolLog);
    }

    @Override
    public PatrolLogDTO update(PatrolLogDTO patrolLogDTO) {
        LOG.debug("Request to update PatrolLog : {}", patrolLogDTO);
        PatrolLog patrolLog = patrolLogMapper.toEntity(patrolLogDTO);
        patrolLog = patrolLogRepository.save(patrolLog);
        return patrolLogMapper.toDto(patrolLog);
    }

    @Override
    public Optional<PatrolLogDTO> partialUpdate(PatrolLogDTO patrolLogDTO) {
        LOG.debug("Request to partially update PatrolLog : {}", patrolLogDTO);

        return patrolLogRepository
            .findById(patrolLogDTO.getId())
            .map(existingPatrolLog -> {
                patrolLogMapper.partialUpdate(existingPatrolLog, patrolLogDTO);

                return existingPatrolLog;
            })
            .map(patrolLogRepository::save)
            .map(patrolLogMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatrolLogDTO> findAll(Pageable pageable) {
        LOG.debug("Request to get all PatrolLogs");
        return patrolLogRepository.findAll(pageable).map(patrolLogMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<PatrolLogDTO> findOne(Long id) {
        LOG.debug("Request to get PatrolLog : {}", id);
        return patrolLogRepository.findById(id).map(patrolLogMapper::toDto);
    }

    @Override
    public void delete(Long id) {
        LOG.debug("Request to delete PatrolLog : {}", id);
        patrolLogRepository.deleteById(id);
    }
}
