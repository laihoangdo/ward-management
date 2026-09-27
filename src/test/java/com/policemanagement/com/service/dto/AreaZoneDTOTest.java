package com.policemanagement.com.service.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class AreaZoneDTOTest {

    @Test
    void dtoEqualsVerifier() throws Exception {
        TestUtil.equalsVerifier(AreaZoneDTO.class);
        AreaZoneDTO areaZoneDTO1 = new AreaZoneDTO();
        areaZoneDTO1.setId(1L);
        AreaZoneDTO areaZoneDTO2 = new AreaZoneDTO();
        assertThat(areaZoneDTO1).isNotEqualTo(areaZoneDTO2);
        areaZoneDTO2.setId(areaZoneDTO1.getId());
        assertThat(areaZoneDTO1).isEqualTo(areaZoneDTO2);
        areaZoneDTO2.setId(2L);
        assertThat(areaZoneDTO1).isNotEqualTo(areaZoneDTO2);
        areaZoneDTO1.setId(null);
        assertThat(areaZoneDTO1).isNotEqualTo(areaZoneDTO2);
    }
}
