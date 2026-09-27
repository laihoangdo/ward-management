package com.policemanagement.com.domain;

import static com.policemanagement.com.domain.PatrolLogTestSamples.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class PatrolLogTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(PatrolLog.class);
        PatrolLog patrolLog1 = getPatrolLogSample1();
        PatrolLog patrolLog2 = new PatrolLog();
        assertThat(patrolLog1).isNotEqualTo(patrolLog2);

        patrolLog2.setId(patrolLog1.getId());
        assertThat(patrolLog1).isEqualTo(patrolLog2);

        patrolLog2 = getPatrolLogSample2();
        assertThat(patrolLog1).isNotEqualTo(patrolLog2);
    }
}
