package com.policemanagement.com.domain;

import static com.policemanagement.com.domain.SecurityAlertTestSamples.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class SecurityAlertTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(SecurityAlert.class);
        SecurityAlert securityAlert1 = getSecurityAlertSample1();
        SecurityAlert securityAlert2 = new SecurityAlert();
        assertThat(securityAlert1).isNotEqualTo(securityAlert2);

        securityAlert2.setId(securityAlert1.getId());
        assertThat(securityAlert1).isEqualTo(securityAlert2);

        securityAlert2 = getSecurityAlertSample2();
        assertThat(securityAlert1).isNotEqualTo(securityAlert2);
    }
}
