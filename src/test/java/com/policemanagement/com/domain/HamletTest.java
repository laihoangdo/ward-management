package com.policemanagement.com.domain;

import static com.policemanagement.com.domain.HamletTestSamples.*;
import static com.policemanagement.com.domain.HouseholdTestSamples.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class HamletTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Hamlet.class);
        Hamlet administrativeHamlet1 = getHamletSample1();
        Hamlet administrativeHamlet2 = new Hamlet();
        assertThat(administrativeHamlet1).isNotEqualTo(administrativeHamlet2);

        administrativeHamlet2.setId(administrativeHamlet1.getId());
        assertThat(administrativeHamlet1).isEqualTo(administrativeHamlet2);

        administrativeHamlet2 = getHamletSample2();
        assertThat(administrativeHamlet1).isNotEqualTo(administrativeHamlet2);
    }

    @Test
    void householdsTest() {
        Hamlet administrativeHamlet = getHamletRandomSampleGenerator();
        Household householdBack = getHouseholdRandomSampleGenerator();

        administrativeHamlet.addHouseholds(householdBack);
        assertThat(administrativeHamlet.getHouseholdses()).containsOnly(householdBack);
        assertThat(householdBack.getAdministrativeHamlet()).isEqualTo(administrativeHamlet);

        administrativeHamlet.removeHouseholds(householdBack);
        assertThat(administrativeHamlet.getHouseholdses()).doesNotContain(householdBack);
        assertThat(householdBack.getAdministrativeHamlet()).isNull();

        administrativeHamlet.householdses(new HashSet<>(Set.of(householdBack)));
        assertThat(administrativeHamlet.getHouseholdses()).containsOnly(householdBack);
        assertThat(householdBack.getAdministrativeHamlet()).isEqualTo(administrativeHamlet);

        administrativeHamlet.setHouseholdses(new HashSet<>());
        assertThat(administrativeHamlet.getHouseholdses()).doesNotContain(householdBack);
        assertThat(householdBack.getAdministrativeHamlet()).isNull();
    }
}
