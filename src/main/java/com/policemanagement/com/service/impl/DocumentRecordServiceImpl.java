package com.policemanagement.com.service.impl;

import com.policemanagement.com.domain.DocumentRecord;
import com.policemanagement.com.repository.DocumentRecordRepository;
import com.policemanagement.com.service.DocumentRecordService;
import com.policemanagement.com.service.dto.DocumentRecordDTO;
import com.policemanagement.com.service.mapper.DocumentRecordMapper;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service Implementation for managing {@link com.policemanagement.com.domain.DocumentRecord}.
 */
@Service
@Transactional
public class DocumentRecordServiceImpl implements DocumentRecordService {

    private static final Logger LOG = LoggerFactory.getLogger(DocumentRecordServiceImpl.class);

    private final DocumentRecordRepository documentRecordRepository;

    private final DocumentRecordMapper documentRecordMapper;

    public DocumentRecordServiceImpl(DocumentRecordRepository documentRecordRepository, DocumentRecordMapper documentRecordMapper) {
        this.documentRecordRepository = documentRecordRepository;
        this.documentRecordMapper = documentRecordMapper;
    }

    @Override
    public DocumentRecordDTO save(DocumentRecordDTO documentRecordDTO) {
        LOG.debug("Request to save DocumentRecord : {}", documentRecordDTO);
        DocumentRecord documentRecord = documentRecordMapper.toEntity(documentRecordDTO);
        documentRecord = documentRecordRepository.save(documentRecord);
        return documentRecordMapper.toDto(documentRecord);
    }

    @Override
    public DocumentRecordDTO update(DocumentRecordDTO documentRecordDTO) {
        LOG.debug("Request to update DocumentRecord : {}", documentRecordDTO);
        DocumentRecord documentRecord = documentRecordMapper.toEntity(documentRecordDTO);
        documentRecord = documentRecordRepository.save(documentRecord);
        return documentRecordMapper.toDto(documentRecord);
    }

    @Override
    public Optional<DocumentRecordDTO> partialUpdate(DocumentRecordDTO documentRecordDTO) {
        LOG.debug("Request to partially update DocumentRecord : {}", documentRecordDTO);

        return documentRecordRepository
            .findById(documentRecordDTO.getId())
            .map(existingDocumentRecord -> {
                documentRecordMapper.partialUpdate(existingDocumentRecord, documentRecordDTO);

                return existingDocumentRecord;
            })
            .map(documentRecordRepository::save)
            .map(documentRecordMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<DocumentRecordDTO> findOne(Long id) {
        LOG.debug("Request to get DocumentRecord : {}", id);
        return documentRecordRepository.findById(id).map(documentRecordMapper::toDto);
    }

    @Override
    public void delete(Long id) {
        LOG.debug("Request to delete DocumentRecord : {}", id);
        documentRecordRepository.deleteById(id);
    }
}
