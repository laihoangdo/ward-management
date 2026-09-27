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
}
