package com.policemanagement.com.service.mapper;

import com.policemanagement.com.domain.Hamlet;
import com.policemanagement.com.service.dto.HamletDTO;
import org.mapstruct.*;

/**
 * Mapper for the entity {@link Hamlet} and its DTO {@link HamletDTO}.
 */
@Mapper(componentModel = "spring")
public interface HamletMapper extends EntityMapper<HamletDTO, Hamlet> {
    @Mapping(target = "hamletName", ignore = true)
    @Mapping(target = "householdses", ignore = true)
    Hamlet toEntity(HamletDTO dto);

    @Named("partialUpdate")
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "hamletName", ignore = true)
    @Mapping(target = "householdses", ignore = true)
    void partialUpdate(@MappingTarget Hamlet entity, HamletDTO dto);

    @AfterMapping
    default void legacyDisplayName(HamletDTO dto, @MappingTarget Hamlet entity) {
        if (dto.getFullName() == null && dto.getHamletName() != null) entity.setFullName(dto.getHamletName());
    }
}
