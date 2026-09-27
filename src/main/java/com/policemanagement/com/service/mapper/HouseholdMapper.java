package com.policemanagement.com.service.mapper;

import com.policemanagement.com.domain.AreaZone;
import com.policemanagement.com.domain.Household;
import com.policemanagement.com.service.dto.AreaZoneDTO;
import com.policemanagement.com.service.dto.HouseholdDTO;
import org.mapstruct.*;

/**
 * Mapper for the entity {@link Household} and its DTO {@link HouseholdDTO}.
 */
@Mapper(componentModel = "spring")
public interface HouseholdMapper extends EntityMapper<HouseholdDTO, Household> {
    @Mapping(target = "areaZone", source = "areaZone", qualifiedByName = "areaZoneName")
    HouseholdDTO toDto(Household s);

    @Named("areaZoneName")
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "id", source = "id")
    @Mapping(target = "name", source = "name")
    AreaZoneDTO toDtoAreaZoneName(AreaZone areaZone);
}
