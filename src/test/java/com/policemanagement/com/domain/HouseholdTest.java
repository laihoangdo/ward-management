package com.policemanagement.com.domain;

import static com.policemanagement.com.domain.AreaZoneTestSamples.*;
import static com.policemanagement.com.domain.HouseholdTestSamples.*;
import static com.policemanagement.com.domain.ResidentTestSamples.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class HouseholdTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Household.class);
        Household household1 = getHouseholdSample1();
        Household household2 = new Household();
        assertThat(household1).isNotEqualTo(household2);

        household2.setId(household1.getId());
        assertThat(household1).isEqualTo(household2);

        household2 = getHouseholdSample2();
        assertThat(household1).isNotEqualTo(household2);
    }

    @Test
    void residentsTest() {
        Household household = getHouseholdRandomSampleGenerator();
        Resident residentBack = getResidentRandomSampleGenerator();

        household.addResidents(residentBack);
        assertThat(household.getResidentses()).containsOnly(residentBack);
        assertThat(residentBack.getHousehold()).isEqualTo(household);

        household.removeResidents(residentBack);
        assertThat(household.getResidentses()).doesNotContain(residentBack);
        assertThat(residentBack.getHousehold()).isNull();

        household.residentses(new HashSet<>(Set.of(residentBack)));
        assertThat(household.getResidentses()).containsOnly(residentBack);
        assertThat(residentBack.getHousehold()).isEqualTo(household);

        household.setResidentses(new HashSet<>());
        assertThat(household.getResidentses()).doesNotContain(residentBack);
        assertThat(residentBack.getHousehold()).isNull();
    }

    @Test
    void areaZoneTest() {
        Household household = getHouseholdRandomSampleGenerator();
        AreaZone areaZoneBack = getAreaZoneRandomSampleGenerator();

        household.setAreaZone(areaZoneBack);
        assertThat(household.getAreaZone()).isEqualTo(areaZoneBack);

        household.areaZone(null);
        assertThat(household.getAreaZone()).isNull();
    }
}
