package com.policemanagement.com.service.impl;

import com.policemanagement.com.domain.Hamlet;
import com.policemanagement.com.repository.HamletRepository;
import com.policemanagement.com.service.HamletService;
import com.policemanagement.com.service.dto.HamletDTO;
import com.policemanagement.com.service.mapper.HamletMapper;
import java.util.LinkedList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service Implementation for managing {@link com.policemanagement.com.domain.Hamlet}.
 */
@Service
@Transactional
public class HamletServiceImpl implements HamletService {

    @org.springframework.beans.factory.annotation.Autowired
    private com.policemanagement.com.service.rbac.RbacService rbac;

    private static final Logger LOG = LoggerFactory.getLogger(HamletServiceImpl.class);

    private final HamletRepository administrativeHamletRepository;

    private final HamletMapper administrativeHamletMapper;

    public HamletServiceImpl(HamletRepository administrativeHamletRepository, HamletMapper administrativeHamletMapper) {
        this.administrativeHamletRepository = administrativeHamletRepository;
        this.administrativeHamletMapper = administrativeHamletMapper;
    }

    @Override
    public HamletDTO save(HamletDTO administrativeHamletDTO) {
        LOG.debug("Request to save Hamlet : {}", administrativeHamletDTO);
        Hamlet administrativeHamlet = administrativeHamletMapper.toEntity(administrativeHamletDTO);
        if (
            administrativeHamlet.getCommuneId() == null ||
            administrativeHamlet.getUnitType() == null ||
            administrativeHamlet.getNameNormalized() == null ||
            administrativeHamlet.getFullName() == null ||
            administrativeHamlet.getFullName().isBlank()
        ) throw new org.springframework.web.server.ResponseStatusException(
            org.springframework.http.HttpStatus.BAD_REQUEST,
            "communeId, unitType, fullName and nameNormalized are required for an administrative hamlet"
        );
        administrativeHamlet = administrativeHamletRepository.save(administrativeHamlet);
        return administrativeHamletMapper.toDto(administrativeHamlet);
    }

    @Override
    public HamletDTO update(HamletDTO dto) {
        Hamlet entity = administrativeHamletRepository.findById(dto.getId()).orElseThrow();
        administrativeHamletMapper.partialUpdate(entity, dto);
        return administrativeHamletMapper.toDto(administrativeHamletRepository.save(entity));
    }

    @Override
    public Optional<HamletDTO> partialUpdate(HamletDTO administrativeHamletDTO) {
        LOG.debug("Request to partially update Hamlet : {}", administrativeHamletDTO);

        return administrativeHamletRepository
            .findById(administrativeHamletDTO.getId())
            .map(existingHamlet -> {
                administrativeHamletMapper.partialUpdate(existingHamlet, administrativeHamletDTO);

                return existingHamlet;
            })
            .map(administrativeHamletRepository::save)
            .map(administrativeHamletMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public List<HamletDTO> findAll() {
        LOG.debug("Request to get all Hamlets");
        return (rbac.global() ? administrativeHamletRepository.findAll() : administrativeHamletRepository.findAllById(rbac.areas()))
            .stream()
            .map(administrativeHamletMapper::toDto)
            .collect(Collectors.toCollection(LinkedList::new));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<HamletDTO> findOne(Long id) {
        LOG.debug("Request to get Hamlet : {}", id);
        return administrativeHamletRepository.findById(id).map(administrativeHamletMapper::toDto);
    }

    @Override
    public void delete(Long id) {
        LOG.debug("Request to delete Hamlet : {}", id);
        administrativeHamletRepository.deleteById(id);
    }
}
