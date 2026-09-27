package com.policemanagement.com.service.mapper;

import com.policemanagement.com.domain.AreaZone;
import com.policemanagement.com.service.dto.AreaZoneDTO;
import org.mapstruct.*;

/**
 * Mapper for the entity {@link AreaZone} and its DTO {@link AreaZoneDTO}.
 */
@Mapper(componentModel = "spring")
public interface AreaZoneMapper extends EntityMapper<AreaZoneDTO, AreaZone> {}
