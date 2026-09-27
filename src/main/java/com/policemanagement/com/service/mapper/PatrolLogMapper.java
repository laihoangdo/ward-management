package com.policemanagement.com.service.mapper;

import com.policemanagement.com.domain.PatrolLog;
import com.policemanagement.com.service.dto.PatrolLogDTO;
import org.mapstruct.*;

/**
 * Mapper for the entity {@link PatrolLog} and its DTO {@link PatrolLogDTO}.
 */
@Mapper(componentModel = "spring")
public interface PatrolLogMapper extends EntityMapper<PatrolLogDTO, PatrolLog> {}
