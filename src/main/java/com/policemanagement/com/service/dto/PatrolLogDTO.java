package com.policemanagement.com.service.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Lob;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * A DTO for the {@link com.policemanagement.com.domain.PatrolLog} entity.
 */
@Schema(description = "Nhật ký công tác / Tuần tra địa bàn")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class PatrolLogDTO implements Serializable {

    private Long id;

    @NotNull
    private String action;

    private String target;

    @Lob
    private String details;

    @NotNull
    private String officerName;

    private String badgeNumber;

    private String ipAddress;

    @NotNull
    private Instant timestamp;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getOfficerName() {
        return officerName;
    }

    public void setOfficerName(String officerName) {
        this.officerName = officerName;
    }

    public String getBadgeNumber() {
        return badgeNumber;
    }

    public void setBadgeNumber(String badgeNumber) {
        this.badgeNumber = badgeNumber;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PatrolLogDTO)) {
            return false;
        }

        PatrolLogDTO patrolLogDTO = (PatrolLogDTO) o;
        if (this.id == null) {
            return false;
        }
        return Objects.equals(this.id, patrolLogDTO.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.id);
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "PatrolLogDTO{" +
            "id=" + getId() +
            ", action='" + getAction() + "'" +
            ", target='" + getTarget() + "'" +
            ", details='" + getDetails() + "'" +
            ", officerName='" + getOfficerName() + "'" +
            ", badgeNumber='" + getBadgeNumber() + "'" +
            ", ipAddress='" + getIpAddress() + "'" +
            ", timestamp='" + getTimestamp() + "'" +
            "}";
    }
}
