package com.policemanagement.com.service.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class HouseholdDTOTest {

    @Test
    void dtoEqualsVerifier() throws Exception {
        TestUtil.equalsVerifier(HouseholdDTO.class);
        HouseholdDTO householdDTO1 = new HouseholdDTO();
        householdDTO1.setId(1L);
        HouseholdDTO householdDTO2 = new HouseholdDTO();
        assertThat(householdDTO1).isNotEqualTo(householdDTO2);
        householdDTO2.setId(householdDTO1.getId());
        assertThat(householdDTO1).isEqualTo(householdDTO2);
        householdDTO2.setId(2L);
        assertThat(householdDTO1).isNotEqualTo(householdDTO2);
        householdDTO1.setId(null);
        assertThat(householdDTO1).isNotEqualTo(householdDTO2);
    }
}
