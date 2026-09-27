package com.policemanagement.com.service.mapper;

import com.policemanagement.com.domain.SecurityAlert;
import com.policemanagement.com.service.dto.SecurityAlertDTO;
import org.mapstruct.*;

/**
 * Mapper for the entity {@link SecurityAlert} and its DTO {@link SecurityAlertDTO}.
 */
@Mapper(componentModel = "spring")
public interface SecurityAlertMapper extends EntityMapper<SecurityAlertDTO, SecurityAlert> {}
