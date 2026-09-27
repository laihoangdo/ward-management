package com.policemanagement.com.service.criteria;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.assertj.core.api.Condition;
import org.junit.jupiter.api.Test;

class ResidentCriteriaTest {

    @Test
    void newResidentCriteriaHasAllFiltersNullTest() {
        var residentCriteria = new ResidentCriteria();
        assertThat(residentCriteria).is(criteriaFiltersAre(Objects::isNull));
    }

    @Test
    void residentCriteriaFluentMethodsCreatesFiltersTest() {
        var residentCriteria = new ResidentCriteria();

        setAllFilters(residentCriteria);

        assertThat(residentCriteria).is(criteriaFiltersAre(Objects::nonNull));
    }

    @Test
    void residentCriteriaCopyCreatesNullFilterTest() {
        var residentCriteria = new ResidentCriteria();
        var copy = residentCriteria.copy();

        assertThat(residentCriteria).satisfies(
            criteria ->
                assertThat(criteria).is(copyFiltersAre(copy, (a, b) -> a == null || a instanceof Boolean ? a == b : a != b && a.equals(b))),
            criteria -> assertThat(criteria).isEqualTo(copy),
            criteria -> assertThat(criteria).hasSameHashCodeAs(copy)
        );

        assertThat(copy).satisfies(
            criteria -> assertThat(criteria).is(criteriaFiltersAre(Objects::isNull)),
            criteria -> assertThat(criteria).isEqualTo(residentCriteria)
        );
    }

    @Test
    void residentCriteriaCopyDuplicatesEveryExistingFilterTest() {
        var residentCriteria = new ResidentCriteria();
        setAllFilters(residentCriteria);

        var copy = residentCriteria.copy();

        assertThat(residentCriteria).satisfies(
            criteria ->
                assertThat(criteria).is(copyFiltersAre(copy, (a, b) -> a == null || a instanceof Boolean ? a == b : a != b && a.equals(b))),
            criteria -> assertThat(criteria).isEqualTo(copy),
            criteria -> assertThat(criteria).hasSameHashCodeAs(copy)
        );

        assertThat(copy).satisfies(
            criteria -> assertThat(criteria).is(criteriaFiltersAre(Objects::nonNull)),
            criteria -> assertThat(criteria).isEqualTo(residentCriteria)
        );
    }

    @Test
    void toStringVerifier() {
        var residentCriteria = new ResidentCriteria();

        assertThat(residentCriteria).hasToString("ResidentCriteria{}");
    }

    private static void setAllFilters(ResidentCriteria residentCriteria) {
        residentCriteria.id();
        residentCriteria.fullName();
        residentCriteria.idCardNumber();
        residentCriteria.birthYear();
        residentCriteria.gender();
        residentCriteria.relationship();
        residentCriteria.residenceType();
        residentCriteria.temporaryRegisteredAt();
        residentCriteria.householdId();
        residentCriteria.distinct();
    }

    private static Condition<ResidentCriteria> criteriaFiltersAre(Function<Object, Boolean> condition) {
        return new Condition<>(
            criteria ->
                condition.apply(criteria.getId()) &&
                condition.apply(criteria.getFullName()) &&
                condition.apply(criteria.getIdCardNumber()) &&
                condition.apply(criteria.getBirthYear()) &&
                condition.apply(criteria.getGender()) &&
                condition.apply(criteria.getRelationship()) &&
                condition.apply(criteria.getResidenceType()) &&
                condition.apply(criteria.getTemporaryRegisteredAt()) &&
                condition.apply(criteria.getHouseholdId()) &&
                condition.apply(criteria.getDistinct()),
            "every filter matches"
        );
    }

    private static Condition<ResidentCriteria> copyFiltersAre(ResidentCriteria copy, BiFunction<Object, Object, Boolean> condition) {
        return new Condition<>(
            criteria ->
                condition.apply(criteria.getId(), copy.getId()) &&
                condition.apply(criteria.getFullName(), copy.getFullName()) &&
                condition.apply(criteria.getIdCardNumber(), copy.getIdCardNumber()) &&
                condition.apply(criteria.getBirthYear(), copy.getBirthYear()) &&
                condition.apply(criteria.getGender(), copy.getGender()) &&
                condition.apply(criteria.getRelationship(), copy.getRelationship()) &&
                condition.apply(criteria.getResidenceType(), copy.getResidenceType()) &&
                condition.apply(criteria.getTemporaryRegisteredAt(), copy.getTemporaryRegisteredAt()) &&
                condition.apply(criteria.getHouseholdId(), copy.getHouseholdId()) &&
                condition.apply(criteria.getDistinct(), copy.getDistinct()),
            "every filter matches"
        );
    }
}
