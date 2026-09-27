package com.policemanagement.com.domain;

import static com.policemanagement.com.domain.AreaZoneTestSamples.*;
import static com.policemanagement.com.domain.HouseholdTestSamples.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AreaZoneTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(AreaZone.class);
        AreaZone areaZone1 = getAreaZoneSample1();
        AreaZone areaZone2 = new AreaZone();
        assertThat(areaZone1).isNotEqualTo(areaZone2);

        areaZone2.setId(areaZone1.getId());
        assertThat(areaZone1).isEqualTo(areaZone2);

        areaZone2 = getAreaZoneSample2();
        assertThat(areaZone1).isNotEqualTo(areaZone2);
    }

    @Test
    void householdsTest() {
        AreaZone areaZone = getAreaZoneRandomSampleGenerator();
        Household householdBack = getHouseholdRandomSampleGenerator();

        areaZone.addHouseholds(householdBack);
        assertThat(areaZone.getHouseholdses()).containsOnly(householdBack);
        assertThat(householdBack.getAreaZone()).isEqualTo(areaZone);

        areaZone.removeHouseholds(householdBack);
        assertThat(areaZone.getHouseholdses()).doesNotContain(householdBack);
        assertThat(householdBack.getAreaZone()).isNull();

        areaZone.householdses(new HashSet<>(Set.of(householdBack)));
        assertThat(areaZone.getHouseholdses()).containsOnly(householdBack);
        assertThat(householdBack.getAreaZone()).isEqualTo(areaZone);

        areaZone.setHouseholdses(new HashSet<>());
        assertThat(areaZone.getHouseholdses()).doesNotContain(householdBack);
        assertThat(householdBack.getAreaZone()).isNull();
    }
}
