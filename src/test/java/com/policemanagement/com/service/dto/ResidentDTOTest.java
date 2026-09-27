package com.policemanagement.com.service.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class ResidentDTOTest {

    @Test
    void dtoEqualsVerifier() throws Exception {
        TestUtil.equalsVerifier(ResidentDTO.class);
        ResidentDTO residentDTO1 = new ResidentDTO();
        residentDTO1.setId(1L);
        ResidentDTO residentDTO2 = new ResidentDTO();
        assertThat(residentDTO1).isNotEqualTo(residentDTO2);
        residentDTO2.setId(residentDTO1.getId());
        assertThat(residentDTO1).isEqualTo(residentDTO2);
        residentDTO2.setId(2L);
        assertThat(residentDTO1).isNotEqualTo(residentDTO2);
        residentDTO1.setId(null);
        assertThat(residentDTO1).isNotEqualTo(residentDTO2);
    }
}
