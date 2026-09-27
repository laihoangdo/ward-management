package com.policemanagement.com.service.criteria;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.assertj.core.api.Condition;
import org.junit.jupiter.api.Test;

class SecurityAlertCriteriaTest {

    @Test
    void newSecurityAlertCriteriaHasAllFiltersNullTest() {
        var securityAlertCriteria = new SecurityAlertCriteria();
        assertThat(securityAlertCriteria).is(criteriaFiltersAre(Objects::isNull));
    }

    @Test
    void securityAlertCriteriaFluentMethodsCreatesFiltersTest() {
        var securityAlertCriteria = new SecurityAlertCriteria();

        setAllFilters(securityAlertCriteria);

        assertThat(securityAlertCriteria).is(criteriaFiltersAre(Objects::nonNull));
    }

    @Test
    void securityAlertCriteriaCopyCreatesNullFilterTest() {
        var securityAlertCriteria = new SecurityAlertCriteria();
        var copy = securityAlertCriteria.copy();

        assertThat(securityAlertCriteria).satisfies(
            criteria ->
                assertThat(criteria).is(copyFiltersAre(copy, (a, b) -> a == null || a instanceof Boolean ? a == b : a != b && a.equals(b))),
            criteria -> assertThat(criteria).isEqualTo(copy),
            criteria -> assertThat(criteria).hasSameHashCodeAs(copy)
        );

        assertThat(copy).satisfies(
            criteria -> assertThat(criteria).is(criteriaFiltersAre(Objects::isNull)),
            criteria -> assertThat(criteria).isEqualTo(securityAlertCriteria)
        );
    }

    @Test
    void securityAlertCriteriaCopyDuplicatesEveryExistingFilterTest() {
        var securityAlertCriteria = new SecurityAlertCriteria();
        setAllFilters(securityAlertCriteria);

        var copy = securityAlertCriteria.copy();

        assertThat(securityAlertCriteria).satisfies(
            criteria ->
                assertThat(criteria).is(copyFiltersAre(copy, (a, b) -> a == null || a instanceof Boolean ? a == b : a != b && a.equals(b))),
            criteria -> assertThat(criteria).isEqualTo(copy),
            criteria -> assertThat(criteria).hasSameHashCodeAs(copy)
        );

        assertThat(copy).satisfies(
            criteria -> assertThat(criteria).is(criteriaFiltersAre(Objects::nonNull)),
            criteria -> assertThat(criteria).isEqualTo(securityAlertCriteria)
        );
    }

    @Test
    void toStringVerifier() {
        var securityAlertCriteria = new SecurityAlertCriteria();

        assertThat(securityAlertCriteria).hasToString("SecurityAlertCriteria{}");
    }

    private static void setAllFilters(SecurityAlertCriteria securityAlertCriteria) {
        securityAlertCriteria.id();
        securityAlertCriteria.alertType();
        securityAlertCriteria.severity();
        securityAlertCriteria.title();
        securityAlertCriteria.location();
        securityAlertCriteria.isResolved();
        securityAlertCriteria.reportedAt();
        securityAlertCriteria.resolvedAt();
        securityAlertCriteria.distinct();
    }

    private static Condition<SecurityAlertCriteria> criteriaFiltersAre(Function<Object, Boolean> condition) {
        return new Condition<>(
            criteria ->
                condition.apply(criteria.getId()) &&
                condition.apply(criteria.getAlertType()) &&
                condition.apply(criteria.getSeverity()) &&
                condition.apply(criteria.getTitle()) &&
                condition.apply(criteria.getLocation()) &&
                condition.apply(criteria.getIsResolved()) &&
                condition.apply(criteria.getReportedAt()) &&
                condition.apply(criteria.getResolvedAt()) &&
                condition.apply(criteria.getDistinct()),
            "every filter matches"
        );
    }

    private static Condition<SecurityAlertCriteria> copyFiltersAre(
        SecurityAlertCriteria copy,
        BiFunction<Object, Object, Boolean> condition
    ) {
        return new Condition<>(
            criteria ->
                condition.apply(criteria.getId(), copy.getId()) &&
                condition.apply(criteria.getAlertType(), copy.getAlertType()) &&
                condition.apply(criteria.getSeverity(), copy.getSeverity()) &&
                condition.apply(criteria.getTitle(), copy.getTitle()) &&
                condition.apply(criteria.getLocation(), copy.getLocation()) &&
                condition.apply(criteria.getIsResolved(), copy.getIsResolved()) &&
                condition.apply(criteria.getReportedAt(), copy.getReportedAt()) &&
                condition.apply(criteria.getResolvedAt(), copy.getResolvedAt()) &&
                condition.apply(criteria.getDistinct(), copy.getDistinct()),
            "every filter matches"
        );
    }
}
