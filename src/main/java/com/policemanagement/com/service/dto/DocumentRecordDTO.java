package com.policemanagement.com.service.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Lob;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.util.Objects;

/**
 * A DTO for the {@link com.policemanagement.com.domain.DocumentRecord} entity.
 */
@Schema(description = "Hồ sơ / Biên bản kiểm tra an ninh trật tự & PCCC")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class DocumentRecordDTO implements Serializable {

    private Long id;

    @NotNull
    private String docName;

    @NotNull
    private String docType;

    private String householdName;

    private String address;

    private String status;

    private String expiryDate;

    private String officer;

    private String phone;

    @Lob
    private String notes;

    private Boolean reminderSent;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDocName() {
        return docName;
    }

    public void setDocName(String docName) {
        this.docName = docName;
    }

    public String getDocType() {
        return docType;
    }

    public void setDocType(String docType) {
        this.docType = docType;
    }

    public String getHouseholdName() {
        return householdName;
    }

    public void setHouseholdName(String householdName) {
        this.householdName = householdName;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(String expiryDate) {
        this.expiryDate = expiryDate;
    }

    public String getOfficer() {
        return officer;
    }

    public void setOfficer(String officer) {
        this.officer = officer;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Boolean getReminderSent() {
        return reminderSent;
    }

    public void setReminderSent(Boolean reminderSent) {
        this.reminderSent = reminderSent;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof DocumentRecordDTO)) {
            return false;
        }

        DocumentRecordDTO documentRecordDTO = (DocumentRecordDTO) o;
        if (this.id == null) {
            return false;
        }
        return Objects.equals(this.id, documentRecordDTO.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.id);
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "DocumentRecordDTO{" +
            "id=" + getId() +
            ", docName='" + getDocName() + "'" +
            ", docType='" + getDocType() + "'" +
            ", householdName='" + getHouseholdName() + "'" +
            ", address='" + getAddress() + "'" +
            ", status='" + getStatus() + "'" +
            ", expiryDate='" + getExpiryDate() + "'" +
            ", officer='" + getOfficer() + "'" +
            ", phone='" + getPhone() + "'" +
            ", notes='" + getNotes() + "'" +
            ", reminderSent='" + getReminderSent() + "'" +
            "}";
    }
}
