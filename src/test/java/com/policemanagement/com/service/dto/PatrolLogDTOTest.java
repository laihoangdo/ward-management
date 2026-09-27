package com.policemanagement.com.service.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class PatrolLogDTOTest {

    @Test
    void dtoEqualsVerifier() throws Exception {
        TestUtil.equalsVerifier(PatrolLogDTO.class);
        PatrolLogDTO patrolLogDTO1 = new PatrolLogDTO();
        patrolLogDTO1.setId(1L);
        PatrolLogDTO patrolLogDTO2 = new PatrolLogDTO();
        assertThat(patrolLogDTO1).isNotEqualTo(patrolLogDTO2);
        patrolLogDTO2.setId(patrolLogDTO1.getId());
        assertThat(patrolLogDTO1).isEqualTo(patrolLogDTO2);
        patrolLogDTO2.setId(2L);
        assertThat(patrolLogDTO1).isNotEqualTo(patrolLogDTO2);
        patrolLogDTO1.setId(null);
        assertThat(patrolLogDTO1).isNotEqualTo(patrolLogDTO2);
    }
}
