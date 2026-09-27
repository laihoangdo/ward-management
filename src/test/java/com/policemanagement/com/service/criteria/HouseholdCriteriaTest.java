package com.policemanagement.com.service.criteria;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.assertj.core.api.Condition;
import org.junit.jupiter.api.Test;

class HouseholdCriteriaTest {

    @Test
    void newHouseholdCriteriaHasAllFiltersNullTest() {
        var householdCriteria = new HouseholdCriteria();
        assertThat(householdCriteria).is(criteriaFiltersAre(Objects::isNull));
    }

    @Test
    void householdCriteriaFluentMethodsCreatesFiltersTest() {
        var householdCriteria = new HouseholdCriteria();

        setAllFilters(householdCriteria);

        assertThat(householdCriteria).is(criteriaFiltersAre(Objects::nonNull));
    }

    @Test
    void householdCriteriaCopyCreatesNullFilterTest() {
        var householdCriteria = new HouseholdCriteria();
        var copy = householdCriteria.copy();

        assertThat(householdCriteria).satisfies(
            criteria ->
                assertThat(criteria).is(copyFiltersAre(copy, (a, b) -> a == null || a instanceof Boolean ? a == b : a != b && a.equals(b))),
            criteria -> assertThat(criteria).isEqualTo(copy),
            criteria -> assertThat(criteria).hasSameHashCodeAs(copy)
        );

        assertThat(copy).satisfies(
            criteria -> assertThat(criteria).is(criteriaFiltersAre(Objects::isNull)),
            criteria -> assertThat(criteria).isEqualTo(householdCriteria)
        );
    }

    @Test
    void householdCriteriaCopyDuplicatesEveryExistingFilterTest() {
        var householdCriteria = new HouseholdCriteria();
        setAllFilters(householdCriteria);

        var copy = householdCriteria.copy();

        assertThat(householdCriteria).satisfies(
            criteria ->
                assertThat(criteria).is(copyFiltersAre(copy, (a, b) -> a == null || a instanceof Boolean ? a == b : a != b && a.equals(b))),
            criteria -> assertThat(criteria).isEqualTo(copy),
            criteria -> assertThat(criteria).hasSameHashCodeAs(copy)
        );

        assertThat(copy).satisfies(
            criteria -> assertThat(criteria).is(criteriaFiltersAre(Objects::nonNull)),
            criteria -> assertThat(criteria).isEqualTo(householdCriteria)
        );
    }

    @Test
    void toStringVerifier() {
        var householdCriteria = new HouseholdCriteria();

        assertThat(householdCriteria).hasToString("HouseholdCriteria{}");
    }

    private static void setAllFilters(HouseholdCriteria householdCriteria) {
        householdCriteria.id();
        householdCriteria.code();
        householdCriteria.houseNumber();
        householdCriteria.street();
        householdCriteria.hamlet();
        householdCriteria.neighborhoodGroup();
        householdCriteria.alley();
        householdCriteria.ownerName();
        householdCriteria.ownerPhone();
        householdCriteria.type();
        householdCriteria.businessName();
        householdCriteria.businessCategory();
        householdCriteria.residentsCount();
        householdCriteria.maleCount();
        householdCriteria.femaleCount();
        householdCriteria.under18Count();
        householdCriteria.above18Count();
        householdCriteria.status();
        householdCriteria.warningMessage();
        householdCriteria.licenseExpiry();
        householdCriteria.licenseType();
        householdCriteria.latitude();
        householdCriteria.longitude();
        householdCriteria.lastCheckedDate();
        householdCriteria.officerInCharge();
        householdCriteria.residentsId();
        householdCriteria.areaZoneId();
        householdCriteria.distinct();
    }

    private static Condition<HouseholdCriteria> criteriaFiltersAre(Function<Object, Boolean> condition) {
        return new Condition<>(
            criteria ->
                condition.apply(criteria.getId()) &&
                condition.apply(criteria.getCode()) &&
                condition.apply(criteria.getHouseNumber()) &&
                condition.apply(criteria.getStreet()) &&
                condition.apply(criteria.getHamlet()) &&
                condition.apply(criteria.getNeighborhoodGroup()) &&
                condition.apply(criteria.getAlley()) &&
                condition.apply(criteria.getOwnerName()) &&
                condition.apply(criteria.getOwnerPhone()) &&
                condition.apply(criteria.getType()) &&
                condition.apply(criteria.getBusinessName()) &&
                condition.apply(criteria.getBusinessCategory()) &&
                condition.apply(criteria.getResidentsCount()) &&
                condition.apply(criteria.getMaleCount()) &&
                condition.apply(criteria.getFemaleCount()) &&
                condition.apply(criteria.getUnder18Count()) &&
                condition.apply(criteria.getAbove18Count()) &&
                condition.apply(criteria.getStatus()) &&
                condition.apply(criteria.getWarningMessage()) &&
                condition.apply(criteria.getLicenseExpiry()) &&
                condition.apply(criteria.getLicenseType()) &&
                condition.apply(criteria.getLatitude()) &&
                condition.apply(criteria.getLongitude()) &&
                condition.apply(criteria.getLastCheckedDate()) &&
                condition.apply(criteria.getOfficerInCharge()) &&
                condition.apply(criteria.getResidentsId()) &&
                condition.apply(criteria.getAreaZoneId()) &&
                condition.apply(criteria.getDistinct()),
            "every filter matches"
        );
    }

    private static Condition<HouseholdCriteria> copyFiltersAre(HouseholdCriteria copy, BiFunction<Object, Object, Boolean> condition) {
        return new Condition<>(
            criteria ->
                condition.apply(criteria.getId(), copy.getId()) &&
                condition.apply(criteria.getCode(), copy.getCode()) &&
                condition.apply(criteria.getHouseNumber(), copy.getHouseNumber()) &&
                condition.apply(criteria.getStreet(), copy.getStreet()) &&
                condition.apply(criteria.getHamlet(), copy.getHamlet()) &&
                condition.apply(criteria.getNeighborhoodGroup(), copy.getNeighborhoodGroup()) &&
                condition.apply(criteria.getAlley(), copy.getAlley()) &&
                condition.apply(criteria.getOwnerName(), copy.getOwnerName()) &&
                condition.apply(criteria.getOwnerPhone(), copy.getOwnerPhone()) &&
                condition.apply(criteria.getType(), copy.getType()) &&
                condition.apply(criteria.getBusinessName(), copy.getBusinessName()) &&
                condition.apply(criteria.getBusinessCategory(), copy.getBusinessCategory()) &&
                condition.apply(criteria.getResidentsCount(), copy.getResidentsCount()) &&
                condition.apply(criteria.getMaleCount(), copy.getMaleCount()) &&
                condition.apply(criteria.getFemaleCount(), copy.getFemaleCount()) &&
                condition.apply(criteria.getUnder18Count(), copy.getUnder18Count()) &&
                condition.apply(criteria.getAbove18Count(), copy.getAbove18Count()) &&
                condition.apply(criteria.getStatus(), copy.getStatus()) &&
                condition.apply(criteria.getWarningMessage(), copy.getWarningMessage()) &&
                condition.apply(criteria.getLicenseExpiry(), copy.getLicenseExpiry()) &&
                condition.apply(criteria.getLicenseType(), copy.getLicenseType()) &&
                condition.apply(criteria.getLatitude(), copy.getLatitude()) &&
                condition.apply(criteria.getLongitude(), copy.getLongitude()) &&
                condition.apply(criteria.getLastCheckedDate(), copy.getLastCheckedDate()) &&
                condition.apply(criteria.getOfficerInCharge(), copy.getOfficerInCharge()) &&
                condition.apply(criteria.getResidentsId(), copy.getResidentsId()) &&
                condition.apply(criteria.getAreaZoneId(), copy.getAreaZoneId()) &&
                condition.apply(criteria.getDistinct(), copy.getDistinct()),
            "every filter matches"
        );
    }
}
