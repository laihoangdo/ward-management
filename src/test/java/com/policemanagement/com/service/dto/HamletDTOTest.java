package com.policemanagement.com.service.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class HamletDTOTest {

    @Test
    void dtoEqualsVerifier() throws Exception {
        TestUtil.equalsVerifier(HamletDTO.class);
        HamletDTO administrativeHamletDTO1 = new HamletDTO();
        administrativeHamletDTO1.setId(1L);
        HamletDTO administrativeHamletDTO2 = new HamletDTO();
        assertThat(administrativeHamletDTO1).isNotEqualTo(administrativeHamletDTO2);
        administrativeHamletDTO2.setId(administrativeHamletDTO1.getId());
        assertThat(administrativeHamletDTO1).isEqualTo(administrativeHamletDTO2);
        administrativeHamletDTO2.setId(2L);
        assertThat(administrativeHamletDTO1).isNotEqualTo(administrativeHamletDTO2);
        administrativeHamletDTO1.setId(null);
        assertThat(administrativeHamletDTO1).isNotEqualTo(administrativeHamletDTO2);
    }
}
