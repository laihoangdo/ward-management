package com.policemanagement.com.service.mapper;

import static com.policemanagement.com.domain.HamletAsserts.*;
import static com.policemanagement.com.domain.HamletTestSamples.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HamletMapperTest {

    private HamletMapper administrativeHamletMapper;

    @BeforeEach
    void setUp() {
        administrativeHamletMapper = new HamletMapperImpl();
    }

    @Test
    void shouldConvertToDtoAndBack() {
        var expected = getHamletSample1();
        var actual = administrativeHamletMapper.toEntity(administrativeHamletMapper.toDto(expected));
        assertHamletAllPropertiesEquals(expected, actual);
    }
}
