package com.policemanagement.com.service.mapper;

import static com.policemanagement.com.domain.AreaZoneAsserts.*;
import static com.policemanagement.com.domain.AreaZoneTestSamples.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AreaZoneMapperTest {

    private AreaZoneMapper areaZoneMapper;

    @BeforeEach
    void setUp() {
        areaZoneMapper = new AreaZoneMapperImpl();
    }

    @Test
    void shouldConvertToDtoAndBack() {
        var expected = getAreaZoneSample1();
        var actual = areaZoneMapper.toEntity(areaZoneMapper.toDto(expected));
        assertAreaZoneAllPropertiesEquals(expected, actual);
    }
}
