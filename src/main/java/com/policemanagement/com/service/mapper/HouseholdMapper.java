package com.policemanagement.com.service.mapper;

import com.policemanagement.com.domain.Hamlet;
import com.policemanagement.com.domain.Household;
import com.policemanagement.com.service.dto.HamletDTO;
import com.policemanagement.com.service.dto.HouseholdDTO;
import org.mapstruct.*;

/**
 * Mapper for the entity {@link Household} and its DTO {@link HouseholdDTO}.
 */
@Mapper(componentModel = "spring")
public interface HouseholdMapper extends EntityMapper<HouseholdDTO, Household> {
    @Mapping(target = "administrativeHamlet", source = "administrativeHamlet", qualifiedByName = "administrativeHamletName")
    HouseholdDTO toDto(Household s);

    @Mapping(target = "administrativeHamlet", ignore = true)
    Household toEntity(HouseholdDTO dto);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "administrativeHamlet", ignore = true)
    void partialUpdate(@MappingTarget Household entity, HouseholdDTO dto);

    @Named("administrativeHamletName")
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "id", source = "id")
    @Mapping(target = "name", source = "name")
    HamletDTO toDtoHamletName(Hamlet administrativeHamlet);
}
