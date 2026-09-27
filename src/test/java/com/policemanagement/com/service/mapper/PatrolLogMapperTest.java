package com.policemanagement.com.service.mapper;

import static com.policemanagement.com.domain.PatrolLogAsserts.*;
import static com.policemanagement.com.domain.PatrolLogTestSamples.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PatrolLogMapperTest {

    private PatrolLogMapper patrolLogMapper;

    @BeforeEach
    void setUp() {
        patrolLogMapper = new PatrolLogMapperImpl();
    }

    @Test
    void shouldConvertToDtoAndBack() {
        var expected = getPatrolLogSample1();
        var actual = patrolLogMapper.toEntity(patrolLogMapper.toDto(expected));
        assertPatrolLogAllPropertiesEquals(expected, actual);
    }
}
