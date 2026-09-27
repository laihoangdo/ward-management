package com.policemanagement.com.service.criteria;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.assertj.core.api.Condition;
import org.junit.jupiter.api.Test;

class DocumentRecordCriteriaTest {

    @Test
    void newDocumentRecordCriteriaHasAllFiltersNullTest() {
        var documentRecordCriteria = new DocumentRecordCriteria();
        assertThat(documentRecordCriteria).is(criteriaFiltersAre(Objects::isNull));
    }

    @Test
    void documentRecordCriteriaFluentMethodsCreatesFiltersTest() {
        var documentRecordCriteria = new DocumentRecordCriteria();

        setAllFilters(documentRecordCriteria);

        assertThat(documentRecordCriteria).is(criteriaFiltersAre(Objects::nonNull));
    }

    @Test
    void documentRecordCriteriaCopyCreatesNullFilterTest() {
        var documentRecordCriteria = new DocumentRecordCriteria();
        var copy = documentRecordCriteria.copy();

        assertThat(documentRecordCriteria).satisfies(
            criteria ->
                assertThat(criteria).is(copyFiltersAre(copy, (a, b) -> a == null || a instanceof Boolean ? a == b : a != b && a.equals(b))),
            criteria -> assertThat(criteria).isEqualTo(copy),
            criteria -> assertThat(criteria).hasSameHashCodeAs(copy)
        );

        assertThat(copy).satisfies(
            criteria -> assertThat(criteria).is(criteriaFiltersAre(Objects::isNull)),
            criteria -> assertThat(criteria).isEqualTo(documentRecordCriteria)
        );
    }

    @Test
    void documentRecordCriteriaCopyDuplicatesEveryExistingFilterTest() {
        var documentRecordCriteria = new DocumentRecordCriteria();
        setAllFilters(documentRecordCriteria);

        var copy = documentRecordCriteria.copy();

        assertThat(documentRecordCriteria).satisfies(
            criteria ->
                assertThat(criteria).is(copyFiltersAre(copy, (a, b) -> a == null || a instanceof Boolean ? a == b : a != b && a.equals(b))),
            criteria -> assertThat(criteria).isEqualTo(copy),
            criteria -> assertThat(criteria).hasSameHashCodeAs(copy)
        );

        assertThat(copy).satisfies(
            criteria -> assertThat(criteria).is(criteriaFiltersAre(Objects::nonNull)),
            criteria -> assertThat(criteria).isEqualTo(documentRecordCriteria)
        );
    }

    @Test
    void toStringVerifier() {
        var documentRecordCriteria = new DocumentRecordCriteria();

        assertThat(documentRecordCriteria).hasToString("DocumentRecordCriteria{}");
    }

    private static void setAllFilters(DocumentRecordCriteria documentRecordCriteria) {
        documentRecordCriteria.id();
        documentRecordCriteria.docName();
        documentRecordCriteria.docType();
        documentRecordCriteria.householdName();
        documentRecordCriteria.address();
        documentRecordCriteria.status();
        documentRecordCriteria.expiryDate();
        documentRecordCriteria.officer();
        documentRecordCriteria.phone();
        documentRecordCriteria.reminderSent();
        documentRecordCriteria.distinct();
    }

    private static Condition<DocumentRecordCriteria> criteriaFiltersAre(Function<Object, Boolean> condition) {
        return new Condition<>(
            criteria ->
                condition.apply(criteria.getId()) &&
                condition.apply(criteria.getDocName()) &&
                condition.apply(criteria.getDocType()) &&
                condition.apply(criteria.getHouseholdName()) &&
                condition.apply(criteria.getAddress()) &&
                condition.apply(criteria.getStatus()) &&
                condition.apply(criteria.getExpiryDate()) &&
                condition.apply(criteria.getOfficer()) &&
                condition.apply(criteria.getPhone()) &&
                condition.apply(criteria.getReminderSent()) &&
                condition.apply(criteria.getDistinct()),
            "every filter matches"
        );
    }

    private static Condition<DocumentRecordCriteria> copyFiltersAre(
        DocumentRecordCriteria copy,
        BiFunction<Object, Object, Boolean> condition
    ) {
        return new Condition<>(
            criteria ->
                condition.apply(criteria.getId(), copy.getId()) &&
                condition.apply(criteria.getDocName(), copy.getDocName()) &&
                condition.apply(criteria.getDocType(), copy.getDocType()) &&
                condition.apply(criteria.getHouseholdName(), copy.getHouseholdName()) &&
                condition.apply(criteria.getAddress(), copy.getAddress()) &&
                condition.apply(criteria.getStatus(), copy.getStatus()) &&
                condition.apply(criteria.getExpiryDate(), copy.getExpiryDate()) &&
                condition.apply(criteria.getOfficer(), copy.getOfficer()) &&
                condition.apply(criteria.getPhone(), copy.getPhone()) &&
                condition.apply(criteria.getReminderSent(), copy.getReminderSent()) &&
                condition.apply(criteria.getDistinct(), copy.getDistinct()),
            "every filter matches"
        );
    }
}
