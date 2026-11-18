package com.policemanagement.com.service.mapper;

import static com.policemanagement.com.domain.HouseholdAsserts.*;
import static com.policemanagement.com.domain.HouseholdTestSamples.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HouseholdMapperTest {

    private HouseholdMapper householdMapper;

    @BeforeEach
    void setUp() {
        householdMapper = new HouseholdMapperImpl();
    }

    @Test
    void shouldConvertToDtoAndBack() {
        var expected = getHouseholdSample1();
        var actual = householdMapper.toEntity(householdMapper.toDto(expected));
        assertHouseholdAllPropertiesEquals(expected, actual);
    }

    @Test
    void incomingRelationshipCannotOverrideTheAuthoritativeHamletId() {
        var dto = new com.policemanagement.com.service.dto.HouseholdDTO();
        dto.setHamletId(7L);
        var unrelated = new com.policemanagement.com.service.dto.HamletDTO();
        unrelated.setId(99L);
        dto.setAdministrativeHamlet(unrelated);
        var entity = householdMapper.toEntity(dto);
        org.junit.jupiter.api.Assertions.assertEquals(7L, entity.getHamletId());
        org.junit.jupiter.api.Assertions.assertNull(entity.getAdministrativeHamlet());
    }
}
