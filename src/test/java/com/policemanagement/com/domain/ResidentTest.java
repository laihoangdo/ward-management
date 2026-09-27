package com.policemanagement.com.domain;

import static com.policemanagement.com.domain.HouseholdTestSamples.*;
import static com.policemanagement.com.domain.ResidentTestSamples.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class ResidentTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Resident.class);
        Resident resident1 = getResidentSample1();
        Resident resident2 = new Resident();
        assertThat(resident1).isNotEqualTo(resident2);

        resident2.setId(resident1.getId());
        assertThat(resident1).isEqualTo(resident2);

        resident2 = getResidentSample2();
        assertThat(resident1).isNotEqualTo(resident2);
    }

    @Test
    void householdTest() {
        Resident resident = getResidentRandomSampleGenerator();
        Household householdBack = getHouseholdRandomSampleGenerator();

        resident.setHousehold(householdBack);
        assertThat(resident.getHousehold()).isEqualTo(householdBack);

        resident.household(null);
        assertThat(resident.getHousehold()).isNull();
    }
}
