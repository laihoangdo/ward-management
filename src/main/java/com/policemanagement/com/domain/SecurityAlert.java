package com.policemanagement.com.domain;

import com.policemanagement.com.domain.enumeration.AlertSeverity;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/**
 * Cảnh báo an ninh / Vi phạm địa bàn
 */
@Entity
@Table(name = "security_alert")
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@SuppressWarnings("common-java:DuplicatedBlocks")
public class SecurityAlert implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "alert_type", nullable = false)
    private String alertType;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false)
    private AlertSeverity severity;

    @NotNull
    @Column(name = "title", nullable = false)
    private String title;

    @Lob
    @Column(name = "description", columnDefinition = "text")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR)
    private String description;

    @Column(name = "location")
    private String location;

    @Column(name = "is_resolved")
    private Boolean isResolved;

    @Column(name = "reported_at")
    private Instant reportedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public SecurityAlert id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAlertType() {
        return this.alertType;
    }

    public SecurityAlert alertType(String alertType) {
        this.setAlertType(alertType);
        return this;
    }

    public void setAlertType(String alertType) {
        this.alertType = alertType;
    }

    public AlertSeverity getSeverity() {
        return this.severity;
    }

    public SecurityAlert severity(AlertSeverity severity) {
        this.setSeverity(severity);
        return this;
    }

    public void setSeverity(AlertSeverity severity) {
        this.severity = severity;
    }

    public String getTitle() {
        return this.title;
    }

    public SecurityAlert title(String title) {
        this.setTitle(title);
        return this;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return this.description;
    }

    public SecurityAlert description(String description) {
        this.setDescription(description);
        return this;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLocation() {
        return this.location;
    }

    public SecurityAlert location(String location) {
        this.setLocation(location);
        return this;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Boolean getIsResolved() {
        return this.isResolved;
    }

    public SecurityAlert isResolved(Boolean isResolved) {
        this.setIsResolved(isResolved);
        return this;
    }

    public void setIsResolved(Boolean isResolved) {
        this.isResolved = isResolved;
    }

    public Instant getReportedAt() {
        return this.reportedAt;
    }

    public SecurityAlert reportedAt(Instant reportedAt) {
        this.setReportedAt(reportedAt);
        return this;
    }

    public void setReportedAt(Instant reportedAt) {
        this.reportedAt = reportedAt;
    }

    public Instant getResolvedAt() {
        return this.resolvedAt;
    }

    public SecurityAlert resolvedAt(Instant resolvedAt) {
        this.setResolvedAt(resolvedAt);
        return this;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof SecurityAlert)) {
            return false;
        }
        return getId() != null && getId().equals(((SecurityAlert) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "SecurityAlert{" +
            "id=" + getId() +
            ", alertType='" + getAlertType() + "'" +
            ", severity='" + getSeverity() + "'" +
            ", title='" + getTitle() + "'" +
            ", description='" + getDescription() + "'" +
            ", location='" + getLocation() + "'" +
            ", isResolved='" + getIsResolved() + "'" +
            ", reportedAt='" + getReportedAt() + "'" +
            ", resolvedAt='" + getResolvedAt() + "'" +
            "}";
    }
}
