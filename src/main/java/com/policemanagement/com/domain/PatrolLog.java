package com.policemanagement.com.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/**
 * Nhật ký công tác / Tuần tra địa bàn
 */
@Entity
@Table(name = "patrol_log")
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@SuppressWarnings("common-java:DuplicatedBlocks")
public class PatrolLog implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "action", nullable = false)
    private String action;

    @Column(name = "target")
    private String target;

    @Lob
    @Column(name = "details", columnDefinition = "text")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR)
    private String details;

    @NotNull
    @Column(name = "officer_name", nullable = false)
    private String officerName;

    @Column(name = "badge_number")
    private String badgeNumber;

    @Column(name = "ip_address")
    private String ipAddress;

    @NotNull
    @Column(name = "timestamp", nullable = false)
    private Instant timestamp;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public PatrolLog id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAction() {
        return this.action;
    }

    public PatrolLog action(String action) {
        this.setAction(action);
        return this;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getTarget() {
        return this.target;
    }

    public PatrolLog target(String target) {
        this.setTarget(target);
        return this;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getDetails() {
        return this.details;
    }

    public PatrolLog details(String details) {
        this.setDetails(details);
        return this;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getOfficerName() {
        return this.officerName;
    }

    public PatrolLog officerName(String officerName) {
        this.setOfficerName(officerName);
        return this;
    }

    public void setOfficerName(String officerName) {
        this.officerName = officerName;
    }

    public String getBadgeNumber() {
        return this.badgeNumber;
    }

    public PatrolLog badgeNumber(String badgeNumber) {
        this.setBadgeNumber(badgeNumber);
        return this;
    }

    public void setBadgeNumber(String badgeNumber) {
        this.badgeNumber = badgeNumber;
    }

    public String getIpAddress() {
        return this.ipAddress;
    }

    public PatrolLog ipAddress(String ipAddress) {
        this.setIpAddress(ipAddress);
        return this;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public Instant getTimestamp() {
        return this.timestamp;
    }

    public PatrolLog timestamp(Instant timestamp) {
        this.setTimestamp(timestamp);
        return this;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PatrolLog)) {
            return false;
        }
        return getId() != null && getId().equals(((PatrolLog) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "PatrolLog{" +
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
