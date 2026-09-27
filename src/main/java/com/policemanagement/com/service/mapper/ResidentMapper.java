package com.policemanagement.com.service.mapper;

import com.policemanagement.com.domain.Household;
import com.policemanagement.com.domain.Resident;
import com.policemanagement.com.service.dto.HouseholdDTO;
import com.policemanagement.com.service.dto.ResidentDTO;
import org.mapstruct.*;

/**
 * Mapper for the entity {@link Resident} and its DTO {@link ResidentDTO}.
 */
@Mapper(componentModel = "spring")
public interface ResidentMapper extends EntityMapper<ResidentDTO, Resident> {
    @Mapping(target = "household", source = "household", qualifiedByName = "householdCode")
    ResidentDTO toDto(Resident s);

    @Named("householdCode")
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "id", source = "id")
    @Mapping(target = "code", source = "code")
    HouseholdDTO toDtoHouseholdCode(Household household);
}
