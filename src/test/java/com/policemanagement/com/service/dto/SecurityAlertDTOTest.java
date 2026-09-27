package com.policemanagement.com.service.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class SecurityAlertDTOTest {

    @Test
    void dtoEqualsVerifier() throws Exception {
        TestUtil.equalsVerifier(SecurityAlertDTO.class);
        SecurityAlertDTO securityAlertDTO1 = new SecurityAlertDTO();
        securityAlertDTO1.setId(1L);
        SecurityAlertDTO securityAlertDTO2 = new SecurityAlertDTO();
        assertThat(securityAlertDTO1).isNotEqualTo(securityAlertDTO2);
        securityAlertDTO2.setId(securityAlertDTO1.getId());
        assertThat(securityAlertDTO1).isEqualTo(securityAlertDTO2);
        securityAlertDTO2.setId(2L);
        assertThat(securityAlertDTO1).isNotEqualTo(securityAlertDTO2);
        securityAlertDTO1.setId(null);
        assertThat(securityAlertDTO1).isNotEqualTo(securityAlertDTO2);
    }
}
