package com.policemanagement.com.service.mapper;

import com.policemanagement.com.domain.DocumentRecord;
import com.policemanagement.com.service.dto.DocumentRecordDTO;
import org.mapstruct.*;

/**
 * Mapper for the entity {@link DocumentRecord} and its DTO {@link DocumentRecordDTO}.
 */
@Mapper(componentModel = "spring")
public interface DocumentRecordMapper extends EntityMapper<DocumentRecordDTO, DocumentRecord> {}
