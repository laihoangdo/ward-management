package com.policemanagement.com.service.criteria;

import com.policemanagement.com.domain.enumeration.AlertSeverity;
import java.io.Serial;
import java.io.Serializable;
import java.util.Objects;
import java.util.Optional;
import org.springdoc.core.annotations.ParameterObject;
import tech.jhipster.service.Criteria;
import tech.jhipster.service.filter.*;

/**
 * Criteria class for the {@link com.policemanagement.com.domain.SecurityAlert} entity. This class is used
 * in {@link com.policemanagement.com.web.rest.SecurityAlertResource} to receive all the possible filtering options from
 * the Http GET request parameters.
 * For example the following could be a valid request:
 * {@code /security-alerts?id.greaterThan=5&attr1.contains=something&attr2.specified=false}
 * As Spring is unable to properly convert the types, unless specific {@link Filter} class are used, we need to use
 * fix type specific filters.
 */
@ParameterObject
@SuppressWarnings("common-java:DuplicatedBlocks")
public class SecurityAlertCriteria implements Serializable, Criteria {

    /**
     * Class for filtering AlertSeverity
     */
    public static class AlertSeverityFilter extends Filter<AlertSeverity> {

        public AlertSeverityFilter() {}

        public AlertSeverityFilter(AlertSeverityFilter filter) {
            super(filter);
        }

        @Override
        public AlertSeverityFilter copy() {
            return new AlertSeverityFilter(this);
        }
    }

    @Serial
    private static final long serialVersionUID = 1L;

    private LongFilter id;

    private StringFilter alertType;

    private AlertSeverityFilter severity;

    private StringFilter title;

    private StringFilter location;

    private BooleanFilter isResolved;

    private InstantFilter reportedAt;

    private InstantFilter resolvedAt;

    private Boolean distinct;

    public SecurityAlertCriteria() {}

    public SecurityAlertCriteria(SecurityAlertCriteria other) {
        this.id = other.optionalId().map(LongFilter::copy).orElse(null);
        this.alertType = other.optionalAlertType().map(StringFilter::copy).orElse(null);
        this.severity = other.optionalSeverity().map(AlertSeverityFilter::copy).orElse(null);
        this.title = other.optionalTitle().map(StringFilter::copy).orElse(null);
        this.location = other.optionalLocation().map(StringFilter::copy).orElse(null);
        this.isResolved = other.optionalIsResolved().map(BooleanFilter::copy).orElse(null);
        this.reportedAt = other.optionalReportedAt().map(InstantFilter::copy).orElse(null);
        this.resolvedAt = other.optionalResolvedAt().map(InstantFilter::copy).orElse(null);
        this.distinct = other.distinct;
    }

    @Override
    public SecurityAlertCriteria copy() {
        return new SecurityAlertCriteria(this);
    }

    public LongFilter getId() {
        return id;
    }

    public Optional<LongFilter> optionalId() {
        return Optional.ofNullable(id);
    }

    public LongFilter id() {
        if (id == null) {
            setId(new LongFilter());
        }
        return id;
    }

    public void setId(LongFilter id) {
        this.id = id;
    }

    public StringFilter getAlertType() {
        return alertType;
    }

    public Optional<StringFilter> optionalAlertType() {
        return Optional.ofNullable(alertType);
    }

    public StringFilter alertType() {
        if (alertType == null) {
            setAlertType(new StringFilter());
        }
        return alertType;
    }

    public void setAlertType(StringFilter alertType) {
        this.alertType = alertType;
    }

    public AlertSeverityFilter getSeverity() {
        return severity;
    }

    public Optional<AlertSeverityFilter> optionalSeverity() {
        return Optional.ofNullable(severity);
    }

    public AlertSeverityFilter severity() {
        if (severity == null) {
            setSeverity(new AlertSeverityFilter());
        }
        return severity;
    }

    public void setSeverity(AlertSeverityFilter severity) {
        this.severity = severity;
    }

    public StringFilter getTitle() {
        return title;
    }

    public Optional<StringFilter> optionalTitle() {
        return Optional.ofNullable(title);
    }

    public StringFilter title() {
        if (title == null) {
            setTitle(new StringFilter());
        }
        return title;
    }

    public void setTitle(StringFilter title) {
        this.title = title;
    }

    public StringFilter getLocation() {
        return location;
    }

    public Optional<StringFilter> optionalLocation() {
        return Optional.ofNullable(location);
    }

    public StringFilter location() {
        if (location == null) {
            setLocation(new StringFilter());
        }
        return location;
    }

    public void setLocation(StringFilter location) {
        this.location = location;
    }

    public BooleanFilter getIsResolved() {
        return isResolved;
    }

    public Optional<BooleanFilter> optionalIsResolved() {
        return Optional.ofNullable(isResolved);
    }

    public BooleanFilter isResolved() {
        if (isResolved == null) {
            setIsResolved(new BooleanFilter());
        }
        return isResolved;
    }

    public void setIsResolved(BooleanFilter isResolved) {
        this.isResolved = isResolved;
    }

    public InstantFilter getReportedAt() {
        return reportedAt;
    }

    public Optional<InstantFilter> optionalReportedAt() {
        return Optional.ofNullable(reportedAt);
    }

    public InstantFilter reportedAt() {
        if (reportedAt == null) {
            setReportedAt(new InstantFilter());
        }
        return reportedAt;
    }

    public void setReportedAt(InstantFilter reportedAt) {
        this.reportedAt = reportedAt;
    }

    public InstantFilter getResolvedAt() {
        return resolvedAt;
    }

    public Optional<InstantFilter> optionalResolvedAt() {
        return Optional.ofNullable(resolvedAt);
    }

    public InstantFilter resolvedAt() {
        if (resolvedAt == null) {
            setResolvedAt(new InstantFilter());
        }
        return resolvedAt;
    }

    public void setResolvedAt(InstantFilter resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public Boolean getDistinct() {
        return distinct;
    }

    public Optional<Boolean> optionalDistinct() {
        return Optional.ofNullable(distinct);
    }

    public Boolean distinct() {
        if (distinct == null) {
            setDistinct(true);
        }
        return distinct;
    }

    public void setDistinct(Boolean distinct) {
        this.distinct = distinct;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        final SecurityAlertCriteria that = (SecurityAlertCriteria) o;
        return (
            Objects.equals(id, that.id) &&
            Objects.equals(alertType, that.alertType) &&
            Objects.equals(severity, that.severity) &&
            Objects.equals(title, that.title) &&
            Objects.equals(location, that.location) &&
            Objects.equals(isResolved, that.isResolved) &&
            Objects.equals(reportedAt, that.reportedAt) &&
            Objects.equals(resolvedAt, that.resolvedAt) &&
            Objects.equals(distinct, that.distinct)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, alertType, severity, title, location, isResolved, reportedAt, resolvedAt, distinct);
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "SecurityAlertCriteria{" +
            optionalId().map(f -> "id=" + f + ", ").orElse("") +
            optionalAlertType().map(f -> "alertType=" + f + ", ").orElse("") +
            optionalSeverity().map(f -> "severity=" + f + ", ").orElse("") +
            optionalTitle().map(f -> "title=" + f + ", ").orElse("") +
            optionalLocation().map(f -> "location=" + f + ", ").orElse("") +
            optionalIsResolved().map(f -> "isResolved=" + f + ", ").orElse("") +
            optionalReportedAt().map(f -> "reportedAt=" + f + ", ").orElse("") +
            optionalResolvedAt().map(f -> "resolvedAt=" + f + ", ").orElse("") +
            optionalDistinct().map(f -> "distinct=" + f + ", ").orElse("") +
        "}";
    }
}
