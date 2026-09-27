package com.policemanagement.com.service.mapper;

import static com.policemanagement.com.domain.ResidentAsserts.*;
import static com.policemanagement.com.domain.ResidentTestSamples.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ResidentMapperTest {

    private ResidentMapper residentMapper;

    @BeforeEach
    void setUp() {
        residentMapper = new ResidentMapperImpl();
    }

    @Test
    void shouldConvertToDtoAndBack() {
        var expected = getResidentSample1();
        var actual = residentMapper.toEntity(residentMapper.toDto(expected));
        assertResidentAllPropertiesEquals(expected, actual);
    }
}
