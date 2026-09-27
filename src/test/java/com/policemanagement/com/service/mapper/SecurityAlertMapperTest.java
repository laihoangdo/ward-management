package com.policemanagement.com.service.mapper;

import static com.policemanagement.com.domain.SecurityAlertAsserts.*;
import static com.policemanagement.com.domain.SecurityAlertTestSamples.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SecurityAlertMapperTest {

    private SecurityAlertMapper securityAlertMapper;

    @BeforeEach
    void setUp() {
        securityAlertMapper = new SecurityAlertMapperImpl();
    }

    @Test
    void shouldConvertToDtoAndBack() {
        var expected = getSecurityAlertSample1();
        var actual = securityAlertMapper.toEntity(securityAlertMapper.toDto(expected));
        assertSecurityAlertAllPropertiesEquals(expected, actual);
    }
}
