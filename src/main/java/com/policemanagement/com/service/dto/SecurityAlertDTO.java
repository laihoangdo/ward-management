package com.policemanagement.com.service.dto;

import com.policemanagement.com.domain.enumeration.AlertSeverity;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Lob;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * A DTO for the {@link com.policemanagement.com.domain.SecurityAlert} entity.
 */
@Schema(description = "Cảnh báo an ninh / Vi phạm địa bàn")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class SecurityAlertDTO implements Serializable {

    private Long id;

    @NotNull
    private String alertType;

    @NotNull
    private AlertSeverity severity;

    @NotNull
    private String title;

    @Lob
    private String description;

    private String location;

    private Boolean isResolved;

    private Instant reportedAt;

    private Instant resolvedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAlertType() {
        return alertType;
    }

    public void setAlertType(String alertType) {
        this.alertType = alertType;
    }

    public AlertSeverity getSeverity() {
        return severity;
    }

    public void setSeverity(AlertSeverity severity) {
        this.severity = severity;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Boolean getIsResolved() {
        return isResolved;
    }

    public void setIsResolved(Boolean isResolved) {
        this.isResolved = isResolved;
    }

    public Instant getReportedAt() {
        return reportedAt;
    }

    public void setReportedAt(Instant reportedAt) {
        this.reportedAt = reportedAt;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof SecurityAlertDTO)) {
            return false;
        }

        SecurityAlertDTO securityAlertDTO = (SecurityAlertDTO) o;
        if (this.id == null) {
            return false;
        }
        return Objects.equals(this.id, securityAlertDTO.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.id);
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "SecurityAlertDTO{" +
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
